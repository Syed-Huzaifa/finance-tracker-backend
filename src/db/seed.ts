import pool from './connection.js';

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding database...');
    
    // Check if data already exists
    const { rows: existingCategories } = await client.query('SELECT COUNT(*) FROM public.categories');
    if (parseInt(existingCategories[0].count) > 0) {
      console.log('Database already seeded, skipping...');
      await client.query('COMMIT');
      return;
    }

    // Insert default expense categories
    await client.query(`
      INSERT INTO public.categories (name, icon, color, parent_category, sort_order) VALUES
        ('Rent', 'Home', 'hsl(200, 70%, 50%)', 'Housing', 1),
        ('Utilities', 'Zap', 'hsl(200, 70%, 50%)', 'Housing', 2),
        ('Internet', 'Wifi', 'hsl(280, 70%, 50%)', 'Bills', 3),
        ('Phone', 'Smartphone', 'hsl(280, 70%, 50%)', 'Bills', 4),
        ('Vehicle Maintenance', 'Car', 'hsl(30, 70%, 50%)', 'Transportation', 5),
        ('Fuel', 'Fuel', 'hsl(30, 70%, 50%)', 'Transportation', 6),
        ('Groceries', 'ShoppingCart', 'hsl(140, 70%, 40%)', 'Food', 7),
        ('Daily Items', 'Package', 'hsl(140, 70%, 40%)', 'Food', 8),
        ('Dinners & Outings', 'Utensils', 'hsl(140, 70%, 40%)', 'Food', 9),
        ('Vape', 'Cloud', 'hsl(340, 70%, 50%)', 'Lifestyle', 10),
        ('Shopping', 'ShoppingBag', 'hsl(340, 70%, 50%)', 'Lifestyle', 11),
        ('Credit Card Payment', 'CreditCard', 'hsl(0, 70%, 50%)', 'Payments', 12),
        ('Debt Payment', 'Landmark', 'hsl(0, 70%, 50%)', 'Payments', 13),
        ('Other', 'MoreHorizontal', 'hsl(220, 10%, 50%)', 'Miscellaneous', 14);
    `);

    // Insert default credit cards
    await client.query(`
      INSERT INTO public.credit_cards (name, bank_name, credit_limit, current_balance) VALUES
        ('Standard Chartered Card', 'Standard Chartered Bank', 110000, 0),
        ('Faysal Bank Card', 'Faysal Bank', 540000, 0);
    `);

    // Insert default debts
    await client.query(`
      INSERT INTO public.debts (name, total_amount, remaining_amount, priority, is_urgent, notes) VALUES
        ('Urgent Debt 1', 100000, 100000, 1, true, 'Urgent - needs to be cleared ASAP'),
        ('Urgent Debt 2', 300000, 300000, 2, true, 'Urgent - needs to be cleared ASAP'),
        ('Debt 3', 0, 0, 3, false, 'Non-urgent debt - amount to be configured');
    `);

    // Insert default settings (PIN hash will be empty initially, user needs to set it)
    await client.query(`
      INSERT INTO public.settings (pin_hash, monthly_income, adjusted_income, adjusted_income_month, salary_day) VALUES
        ('', 470000, NULL, 'February 2025', 1);
    `);

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(() => {
    console.log('Database seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exit(1);
  });

