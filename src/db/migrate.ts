import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating tables...');
    
    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        monthly_income NUMERIC NOT NULL DEFAULT 0,
        adjusted_income NUMERIC,
        adjusted_income_month TEXT,
        salary_day INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.categories (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        parent_category TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.expenses (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        amount NUMERIC NOT NULL,
        category_id UUID REFERENCES public.categories(id),
        description TEXT,
        expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create fixed expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.fixed_expenses (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        reminder_day INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        last_paid_date DATE,
        expense_type text NOT NULL DEFAULT 'fixed',
        auto_deduct boolean DEFAULT false,
        billing_cycle text DEFAULT 'monthly',
        next_billing_date date,
        description text,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT valid_expense_type CHECK (expense_type IN ('fixed', 'subscription')),
        CONSTRAINT valid_billing_cycle CHECK (billing_cycle IN ('monthly', 'yearly', 'weekly', 'quarterly'))
      );
    `);

    // Create credit cards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.credit_cards (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        credit_limit NUMERIC NOT NULL,
        current_balance NUMERIC NOT NULL DEFAULT 0,
        statement_day INTEGER DEFAULT 1,
        due_day INTEGER DEFAULT 15,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create debts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.debts (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        total_amount NUMERIC NOT NULL,
        remaining_amount NUMERIC NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        is_urgent BOOLEAN DEFAULT false,
        has_interest BOOLEAN DEFAULT false,
        interest_rate NUMERIC DEFAULT 0,
        deadline DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create debt payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.debt_payments (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create goals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.goals (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        target_amount NUMERIC NOT NULL,
        current_amount NUMERIC NOT NULL DEFAULT 0,
        goal_type TEXT NOT NULL CHECK (goal_type IN ('need', 'want')),
        priority INTEGER DEFAULT 1,
        target_date DATE,
        notes TEXT,
        is_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create savings contributions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.savings_contributions (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create credit card payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.credit_card_payments (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create function to update timestamps
    await client.query(`
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for automatic timestamp updates
    await client.query(`
      DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;
      CREATE TRIGGER update_settings_updated_at 
        BEFORE UPDATE ON public.settings 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
      CREATE TRIGGER update_expenses_updated_at 
        BEFORE UPDATE ON public.expenses 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON public.credit_cards;
      CREATE TRIGGER update_credit_cards_updated_at 
        BEFORE UPDATE ON public.credit_cards 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_debts_updated_at ON public.debts;
      CREATE TRIGGER update_debts_updated_at 
        BEFORE UPDATE ON public.debts 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
      CREATE TRIGGER update_goals_updated_at 
        BEFORE UPDATE ON public.goals 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

migrate()
  .then(() => {
    console.log('Database migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });

