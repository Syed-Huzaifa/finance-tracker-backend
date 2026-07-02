import pool from '../db/connection.js';

/**
 * A compact, pre-aggregated view of a user's finances.
 *
 * Everything the AI needs is summarized here server-side so we never ship raw
 * transaction rows to the model. All sums/ratios are computed in code (not by
 * the LLM) to keep the arithmetic deterministic and the token count low.
 * Amounts are in the user's display currency (PKR).
 */
export interface FinancialSnapshot {
  currency: string;
  generatedAt: string;
  income: {
    monthly: number;
    adjustedThisMonth: number | null;
  };
  cashFlow: {
    avgMonthlyVariableSpend: number;
    monthlyFixedExpenses: number;
    monthlyObligations: number;
    estimatedMonthlySurplus: number;
  };
  spendingByCategory: Array<{
    category: string;
    monthlyAverage: number;
    shareOfSpendPct: number;
  }>;
  fixedExpenses: Array<{
    name: string;
    monthlyEquivalent: number;
    billingCycle: string;
    type: string;
  }>;
  creditCards: Array<{
    name: string;
    bank: string;
    limit: number;
    balance: number;
    utilizationPct: number;
    dueDay: number;
  }>;
  debts: Array<{
    name: string;
    total: number;
    remaining: number;
    isUrgent: boolean;
    interestRatePct: number;
    deadline: string | null;
    priority: number;
  }>;
  goals: Array<{
    name: string;
    type: string;
    target: number;
    current: number;
    remaining: number;
    progressPct: number;
    targetDate: string | null;
    priority: number;
  }>;
  totals: {
    totalDebtRemaining: number;
    totalUrgentDebt: number;
    totalCreditCardBalance: number;
    totalCreditLimit: number;
    overallCreditUtilizationPct: number;
    totalGoalGap: number;
    monthlySavingsCapacity: number;
  };
}

const MONTHS_LOOKBACK = 3;

const round = (n: number): number => Math.round(n * 100) / 100;
const pct = (num: number, denom: number): number =>
  denom > 0 ? round((num / denom) * 100) : 0;

/** Normalize a fixed expense / subscription to a per-month figure. */
function monthlyEquivalent(amount: number, billingCycle: string): number {
  switch (billingCycle) {
    case 'yearly':
      return amount / 12;
    case 'quarterly':
      return amount / 3;
    case 'weekly':
      return amount * (52 / 12);
    case 'monthly':
    default:
      return amount;
  }
}

/**
 * Build the aggregated financial snapshot for a single user.
 * Runs all queries in parallel; aggregation happens in JS since personal-finance
 * data volumes are small and this keeps the SQL simple and portable.
 */
export async function buildFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
  const lookbackStart = new Date();
  lookbackStart.setMonth(lookbackStart.getMonth() - MONTHS_LOOKBACK);
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0];

  const [
    settingsRes,
    expensesRes,
    fixedRes,
    cardsRes,
    debtsRes,
    goalsRes,
  ] = await Promise.all([
    pool.query('SELECT * FROM public.settings WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT e.amount, e.expense_date, c.name AS category_name
         FROM public.expenses e
         LEFT JOIN public.categories c ON e.category_id = c.id
        WHERE e.user_id = $1 AND e.expense_date >= $2`,
      [userId, lookbackStartStr]
    ),
    pool.query(
      `SELECT name, amount, billing_cycle, expense_type
         FROM public.fixed_expenses
        WHERE user_id = $1 AND is_active = true`,
      [userId]
    ),
    pool.query('SELECT * FROM public.credit_cards WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM public.debts WHERE user_id = $1 ORDER BY priority', [userId]),
    pool.query(
      'SELECT * FROM public.goals WHERE user_id = $1 AND is_completed = false ORDER BY priority',
      [userId]
    ),
  ]);

  const settings = settingsRes.rows[0] || {};
  const monthlyIncome = Number(settings.monthly_income) || 0;

  // ---- Spending by category (monthly average over lookback window) ----
  const categoryTotals = new Map<string, number>();
  let totalVariableSpend = 0;
  for (const row of expensesRes.rows) {
    const amount = Number(row.amount) || 0;
    const cat = row.category_name || 'Uncategorized';
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amount);
    totalVariableSpend += amount;
  }
  const avgMonthlyVariableSpend = round(totalVariableSpend / MONTHS_LOOKBACK);

  const spendingByCategory = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({
      category,
      monthlyAverage: round(total / MONTHS_LOOKBACK),
      shareOfSpendPct: pct(total, totalVariableSpend),
    }))
    .filter((c) => c.monthlyAverage > 0)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  // ---- Fixed expenses / subscriptions ----
  const fixedExpenses = fixedRes.rows.map((row: any) => ({
    name: row.name,
    monthlyEquivalent: round(monthlyEquivalent(Number(row.amount) || 0, row.billing_cycle || 'monthly')),
    billingCycle: row.billing_cycle || 'monthly',
    type: row.expense_type || 'fixed',
  }));
  const monthlyFixedExpenses = round(
    fixedExpenses.reduce((sum, f) => sum + f.monthlyEquivalent, 0)
  );

  // ---- Credit cards ----
  const creditCards = cardsRes.rows.map((row: any) => {
    const limit = Number(row.credit_limit) || 0;
    const balance = Number(row.current_balance) || 0;
    return {
      name: row.name,
      bank: row.bank_name,
      limit,
      balance,
      utilizationPct: pct(balance, limit),
      dueDay: row.due_day,
    };
  });
  const totalCreditCardBalance = round(
    creditCards.reduce((sum, c) => sum + c.balance, 0)
  );
  const totalCreditLimit = round(creditCards.reduce((sum, c) => sum + c.limit, 0));

  // ---- Debts ----
  const debts = debtsRes.rows.map((row: any) => ({
    name: row.name,
    total: Number(row.total_amount) || 0,
    remaining: Number(row.remaining_amount) || 0,
    isUrgent: !!row.is_urgent,
    interestRatePct: row.has_interest ? Number(row.interest_rate) || 0 : 0,
    deadline: row.deadline ? new Date(row.deadline).toISOString().split('T')[0] : null,
    priority: row.priority,
  }));
  const totalDebtRemaining = round(debts.reduce((sum, d) => sum + d.remaining, 0));
  const totalUrgentDebt = round(
    debts.filter((d) => d.isUrgent).reduce((sum, d) => sum + d.remaining, 0)
  );

  // ---- Goals ----
  const goals = goalsRes.rows.map((row: any) => {
    const target = Number(row.target_amount) || 0;
    const current = Number(row.current_amount) || 0;
    return {
      name: row.name,
      type: row.goal_type,
      target,
      current,
      remaining: round(Math.max(0, target - current)),
      progressPct: pct(current, target),
      targetDate: row.target_date ? new Date(row.target_date).toISOString().split('T')[0] : null,
      priority: row.priority,
    };
  });
  const totalGoalGap = round(goals.reduce((sum, g) => sum + g.remaining, 0));

  const estimatedMonthlySurplus = round(
    monthlyIncome - monthlyFixedExpenses - avgMonthlyVariableSpend
  );

  return {
    currency: 'PKR',
    generatedAt: new Date().toISOString(),
    income: {
      monthly: monthlyIncome,
      adjustedThisMonth: settings.adjusted_income != null ? Number(settings.adjusted_income) : null,
    },
    cashFlow: {
      avgMonthlyVariableSpend,
      monthlyFixedExpenses,
      monthlyObligations: round(monthlyFixedExpenses + avgMonthlyVariableSpend),
      estimatedMonthlySurplus,
    },
    spendingByCategory,
    fixedExpenses,
    creditCards,
    debts,
    goals,
    totals: {
      totalDebtRemaining,
      totalUrgentDebt,
      totalCreditCardBalance,
      totalCreditLimit,
      overallCreditUtilizationPct: pct(totalCreditCardBalance, totalCreditLimit),
      totalGoalGap,
      monthlySavingsCapacity: estimatedMonthlySurplus,
    },
  };
}
