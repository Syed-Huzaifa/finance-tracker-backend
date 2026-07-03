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
    
    console.log('Checking existing schema...');
    
    // Check if old schema exists (settings table with pin_hash) or if settings table exists without user_id
    const { rows: settingsColumns } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'settings'
    `);
    
    const hasPinHash = settingsColumns.some((col: any) => col.column_name === 'pin_hash');
    const hasUserId = settingsColumns.some((col: any) => col.column_name === 'user_id');
    const needsMigration = hasPinHash || (settingsColumns.length > 0 && !hasUserId);
    
    if (needsMigration) {
      console.log('Old schema detected. Migrating to new schema...');
      console.log('WARNING: This will drop all existing data!');
      
      // Drop all existing tables in correct order (respecting foreign keys)
      await client.query('DROP TABLE IF EXISTS public.savings_contributions CASCADE');
      await client.query('DROP TABLE IF EXISTS public.credit_card_payments CASCADE');
      await client.query('DROP TABLE IF EXISTS public.debt_payments CASCADE');
      await client.query('DROP TABLE IF EXISTS public.goals CASCADE');
      await client.query('DROP TABLE IF EXISTS public.debts CASCADE');
      await client.query('DROP TABLE IF EXISTS public.credit_cards CASCADE');
      await client.query('DROP TABLE IF EXISTS public.fixed_expenses CASCADE');
      await client.query('DROP TABLE IF EXISTS public.expenses CASCADE');
      await client.query('DROP TABLE IF EXISTS public.categories CASCADE');
      await client.query('DROP TABLE IF EXISTS public.settings CASCADE');
      await client.query('DROP TABLE IF EXISTS public.users CASCADE');
      
      console.log('Old tables dropped. Creating new schema...');
    }
    
    console.log('Creating tables...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        monthly_income NUMERIC NOT NULL DEFAULT 0,
        adjusted_income NUMERIC,
        adjusted_income_month TEXT,
        salary_day INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        UNIQUE(user_id)
      );
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.categories (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
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
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

    // Auth0 integration: identify users by their Auth0 subject, and relax the
    // local-password columns (Auth0 owns authentication now).
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth0_sub TEXT;`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_auth0_sub_key ON public.users (auth0_sub);`);
    await client.query(`ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;`);
    await client.query(`ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;`);
    await client.query(`ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;`);

    // Create AI analyses table (stores generated AI financial analyses)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_analyses (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        result JSONB NOT NULL,
        model TEXT,
        instructions TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);

    // Backfill the column for databases created before custom instructions existed.
    await client.query(`
      ALTER TABLE public.ai_analyses ADD COLUMN IF NOT EXISTS instructions TEXT;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_analyses_user_created
        ON public.ai_analyses (user_id, created_at DESC);
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

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON public.users 
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

