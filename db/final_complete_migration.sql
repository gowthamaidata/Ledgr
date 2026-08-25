-- ============================================================
-- LEDGR — Final Complete Migration
-- Run this in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DO blocks.
-- Order: v1 tables → column fixes → RLS fixes → RPC fixes → admin setup
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Core Tables (IF NOT EXISTS — safe to re-run)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'INR',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  monthly_income_target numeric(15,2),
  monthly_spending_target numeric(15,2),
  onboarding_completed boolean NOT NULL DEFAULT false,
  preferences jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('cash','bank','credit_card','upi','savings','other')),
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  color text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  group_name text,
  icon text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('expense','income')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  merchant text,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  next_due_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('expense','income','transfer')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  merchant text,
  party text,
  description text,
  notes text,
  payment_method text,
  transaction_date date NOT NULL,
  transfer_to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_recurring_instance boolean NOT NULL DEFAULT false,
  recurring_id uuid REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, period)
);

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric(15,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(15,2) NOT NULL DEFAULT 0,
  target_date date,
  color text,
  icon text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 2: Add missing columns (idempotent)
-- ============================================================

-- transactions: add columns the frontend expects
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS party text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Backfill: copy merchant → party, description → notes
UPDATE public.transactions SET party = merchant WHERE party IS NULL AND merchant IS NOT NULL;
UPDATE public.transactions SET notes = description WHERE notes IS NULL AND description IS NOT NULL;

-- profiles: add reviewed_dates for DailyReview persistence
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reviewed_dates TEXT[] DEFAULT '{}';

-- goals: add notes
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS notes text;

-- recurring_transactions: ensure all needed columns exist
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS next_due_date date DEFAULT CURRENT_DATE;

-- Handle next_date → next_due_date rename if still on old schema
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurring_transactions' AND column_name = 'next_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurring_transactions' AND column_name = 'next_due_date'
  ) THEN
    ALTER TABLE public.recurring_transactions RENAME COLUMN next_date TO next_due_date;
  END IF;
END $$;

-- Add role enum and role column to app_admins
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support');
  END IF;
END $$;

ALTER TABLE public.app_admins ADD COLUMN IF NOT EXISTS role admin_role DEFAULT 'admin';

-- ============================================================
-- SECTION 3: Indexes (IF NOT EXISTS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(user_id, merchant) WHERE merchant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_party ON transactions(user_id, party) WHERE party IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(user_id, payment_method) WHERE payment_method IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_transactions(user_id, is_active, next_due_date);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- SECTION 4: Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies cleanly
DROP POLICY IF EXISTS profiles_own ON profiles;
DROP POLICY IF EXISTS accounts_own ON accounts;
DROP POLICY IF EXISTS categories_own ON categories;
DROP POLICY IF EXISTS transactions_own ON transactions;
DROP POLICY IF EXISTS recurring_own ON recurring_transactions;
DROP POLICY IF EXISTS budgets_own ON budgets;
DROP POLICY IF EXISTS goals_own ON goals;
DROP POLICY IF EXISTS audit_read_own ON audit_log;
DROP POLICY IF EXISTS audit_insert ON audit_log;
DROP POLICY IF EXISTS "Users can insert their own audit entries" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "Users can view their own audit entries" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_own" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;

CREATE POLICY profiles_own ON profiles
  FOR ALL USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY accounts_own ON accounts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY categories_own ON categories
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY transactions_own ON transactions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY recurring_own ON recurring_transactions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY budgets_own ON budgets
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY goals_own ON goals
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- audit_log: users see their own entries
CREATE POLICY audit_log_select_own ON audit_log
  FOR SELECT USING (user_id = auth.uid());

-- audit_log: admins see all entries (by email check)
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_admins
      WHERE app_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- audit_log: only SECURITY DEFINER triggers insert (no direct user access)
-- Service role bypasses RLS, triggers run as SECURITY DEFINER

-- ============================================================
-- SECTION 5: Trigger Functions
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed 14 expense + 5 income categories on profile creation
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type, icon, color, is_system, sort_order)
  VALUES
    (NEW.id, 'Food',                 'expense', '🍽️',  '#ef4444', true,  1),
    (NEW.id, 'Rent',                 'expense', '🏠',   '#6366f1', true,  2),
    (NEW.id, 'Loan/EMI',             'expense', '🏦',   '#78716c', true,  3),
    (NEW.id, 'Bills',                'expense', '💡',   '#f59e0b', true,  4),
    (NEW.id, 'Transport',            'expense', '🚗',   '#eab308', true,  5),
    (NEW.id, 'Shopping',             'expense', '🛍️',  '#ec4899', true,  6),
    (NEW.id, 'Health',               'expense', '💊',   '#14b8a6', true,  7),
    (NEW.id, 'Travel',               'expense', '✈️',   '#06b6d4', true,  8),
    (NEW.id, 'Family & Gifts',       'expense', '🎁',   '#fb923c', true,  9),
    (NEW.id, 'Education',            'expense', '📚',   '#0ea5e9', true,  10),
    (NEW.id, 'Personal',             'expense', '💇',   '#f472b6', true,  11),
    (NEW.id, 'Entertainment',        'expense', '🎬',   '#a855f7', true,  12),
    (NEW.id, 'Savings & Investment', 'expense', '📈',   '#22c55e', true,  13),
    (NEW.id, 'Other',                'expense', '📦',   '#9ca3af', true,  14),
    (NEW.id, 'Salary',               'income',  '💰',   '#10b981', true,  1),
    (NEW.id, 'Interest',             'income',  '🏦',   '#3b82f6', true,  2),
    (NEW.id, 'Trading/Investment Income', 'income', '📊', '#8b5cf6', true, 3),
    (NEW.id, 'Bonus',                'income',  '🎉',   '#f59e0b', true,  4),
    (NEW.id, 'Other Income',         'income',  '📦',   '#9ca3af', true,  5)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_categories ON public.profiles;
CREATE TRIGGER on_profile_created_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- Seed 4 default accounts on profile creation
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, type, sort_order)
  VALUES
    (NEW.id, 'Cash',         'cash',        1),
    (NEW.id, 'Bank Account', 'bank',        2),
    (NEW.id, 'Credit Card',  'credit_card', 3),
    (NEW.id, 'UPI',          'upi',         4)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_accounts ON public.profiles;
CREATE TRIGGER on_profile_created_accounts
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounts();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
DROP TRIGGER IF EXISTS set_updated_at_accounts ON accounts;
DROP TRIGGER IF EXISTS set_updated_at_transactions ON transactions;
DROP TRIGGER IF EXISTS set_updated_at_recurring ON recurring_transactions;
DROP TRIGGER IF EXISTS set_updated_at_budgets ON budgets;
DROP TRIGGER IF EXISTS set_updated_at_goals ON goals;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_recurring BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_budgets BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_goals BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Increment category usage_count when a transaction is inserted
CREATE OR REPLACE FUNCTION public.increment_category_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    UPDATE public.categories
    SET usage_count = usage_count + 1
    WHERE id = NEW.category_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_inserted ON transactions;
CREATE TRIGGER on_transaction_inserted
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.increment_category_usage();

-- Audit log trigger for transactions, accounts, budgets
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (OLD.user_id, 'delete', TG_TABLE_NAME, OLD.id, '{}');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.user_id, 'update', TG_TABLE_NAME, NEW.id, '{}');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.user_id, 'create', TG_TABLE_NAME, NEW.id, '{}');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_transactions ON transactions;
DROP TRIGGER IF EXISTS audit_accounts ON accounts;
DROP TRIGGER IF EXISTS audit_budgets ON budgets;

CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_budgets
  AFTER INSERT OR UPDATE OR DELETE ON budgets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============================================================
-- SECTION 6: Dashboard / Report RPC Functions
-- ============================================================

-- Today's summary (expenses + income for a given date)
DROP FUNCTION IF EXISTS public.get_today_summary();
DROP FUNCTION IF EXISTS public.get_today_summary(date);

CREATE OR REPLACE FUNCTION public.get_today_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'total_spent',       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'total_income',      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'daily_average', (
      SELECT COALESCE(AVG(daily_total), 0) FROM (
        SELECT SUM(amount) AS daily_total
        FROM transactions
        WHERE user_id = auth.uid()
          AND type = 'expense'
          AND transaction_date >= (p_date - INTERVAL '30 days')::date
          AND transaction_date < p_date
        GROUP BY transaction_date
      ) sub
    )
  ) INTO result
  FROM transactions
  WHERE user_id = auth.uid()
    AND transaction_date = p_date;

  RETURN COALESCE(result, json_build_object(
    'total_spent', 0, 'total_income', 0, 'transaction_count', 0, 'daily_average', 0
  ));
END;
$$;

-- Monthly summary (income, expenses, count)
DROP FUNCTION IF EXISTS public.get_monthly_summary();
DROP FUNCTION IF EXISTS public.get_monthly_summary(int, int);

CREATE OR REPLACE FUNCTION public.get_monthly_summary(
  p_year  int DEFAULT EXTRACT(YEAR  FROM CURRENT_DATE)::int,
  p_month int DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result json;
  month_start date;
  month_end   date;
BEGIN
  month_start := make_date(p_year, p_month, 1);
  month_end   := (month_start + INTERVAL '1 month - 1 day')::date;

  SELECT json_build_object(
    'total_income',      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0),
    'total_expenses',    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'total_expense',     COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'month', p_month,
    'year',  p_year
  ) INTO result
  FROM transactions
  WHERE user_id = auth.uid()
    AND transaction_date >= month_start
    AND transaction_date <= month_end;

  RETURN COALESCE(result, json_build_object(
    'total_income', 0, 'total_expenses', 0, 'total_expense', 0,
    'transaction_count', 0, 'month', p_month, 'year', p_year
  ));
END;
$$;

-- Category spending for a date range (returns both expense and income types)
DROP FUNCTION IF EXISTS public.get_category_spending(date, date);

CREATE OR REPLACE FUNCTION public.get_category_spending(p_start date, p_end date)
RETURNS TABLE(category_name text, total numeric, type text) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(c.name, 'Uncategorized') AS category_name,
      SUM(t.amount) AS total,
      t.type
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = auth.uid()
      AND t.transaction_date >= p_start
      AND t.transaction_date <= p_end
      AND t.type IN ('expense', 'income')
    GROUP BY c.name, t.type
    ORDER BY SUM(t.amount) DESC;
END;
$$;

-- Daily spending totals for trend charts
DROP FUNCTION IF EXISTS public.get_daily_spending(date, date);

CREATE OR REPLACE FUNCTION public.get_daily_spending(p_start date, p_end date)
RETURNS TABLE(date date, total numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      transaction_date AS date,
      SUM(amount)      AS total
    FROM transactions
    WHERE user_id = auth.uid()
      AND type = 'expense'
      AND transaction_date >= p_start
      AND transaction_date <= p_end
    GROUP BY transaction_date
    ORDER BY transaction_date;
END;
$$;

-- ============================================================
-- SECTION 7: Admin Functions
-- ============================================================

-- Check if current user is admin (by email)
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- Admin dashboard stats
DROP FUNCTION IF EXISTS public.admin_stats();

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  SELECT json_build_object(
    'total_users',         (SELECT COUNT(*) FROM profiles),
    'total_transactions',  (SELECT COUNT(*) FROM transactions),
    'total_categories',    (SELECT COUNT(*) FROM categories WHERE NOT is_system),
    'total_accounts',      (SELECT COUNT(*) FROM accounts),
    'users_today',         (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'transactions_today',  (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin: list users with transaction counts
DROP FUNCTION IF EXISTS public.admin_list_users(int, int);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_limit  int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  user_id              uuid,
  email                text,
  full_name            text,
  created_at           timestamptz,
  onboarding_completed boolean,
  transaction_count    bigint,
  last_active          timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      au.email::text,
      p.full_name,
      p.created_at,
      p.onboarding_completed,
      (SELECT COUNT(*) FROM transactions t WHERE t.user_id = p.id),
      (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id)
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Admin: search users by email or name
DROP FUNCTION IF EXISTS public.admin_search_users(text);

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(
  user_id    uuid,
  email      text,
  full_name  text,
  created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      au.email::text,
      p.full_name,
      p.created_at
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE au.email ILIKE '%' || p_query || '%'
       OR p.full_name ILIKE '%' || p_query || '%'
    ORDER BY p.created_at DESC
    LIMIT 20;
END;
$$;

-- Admin: recent activity feed
DROP FUNCTION IF EXISTS public.admin_recent_activity(int);

CREATE OR REPLACE FUNCTION public.admin_recent_activity(p_limit int DEFAULT 20)
RETURNS TABLE(email text, action text, created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT * FROM (
      (
        SELECT au.email::text, 'signup'::text, p.created_at
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        ORDER BY p.created_at DESC
        LIMIT p_limit
      )
      UNION ALL
      (
        SELECT au.email::text, ('added ' || t.type)::text, t.created_at
        FROM transactions t
        JOIN auth.users au ON au.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT p_limit
      )
    ) combined
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

-- Self-service: delete all own data (for account deletion)
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid        uuid;
  user_email text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  DELETE FROM budgets              WHERE user_id = uid;
  DELETE FROM goals                WHERE user_id = uid;
  DELETE FROM recurring_transactions WHERE user_id = uid;
  DELETE FROM transactions         WHERE user_id = uid;
  DELETE FROM categories           WHERE user_id = uid;
  DELETE FROM accounts             WHERE user_id = uid;
  DELETE FROM audit_log            WHERE user_id = uid;
  DELETE FROM app_admins           WHERE email = user_email;
  DELETE FROM profiles             WHERE id = uid;
END;
$$;

-- ============================================================
-- SECTION 8: Bootstrap Super Admin
-- ============================================================

-- Insert or update gowtham.aidata@gmail.com as super_admin
-- Only inserts if user exists in auth.users

INSERT INTO public.app_admins (email, role)
SELECT u.email, 'super_admin'::admin_role
FROM auth.users u
WHERE u.email = 'gowtham.aidata@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.app_admins a WHERE a.email = u.email
  );

UPDATE public.app_admins
SET role = 'super_admin'::admin_role
WHERE email = 'gowtham.aidata@gmail.com';

-- ============================================================
-- SECTION 9: Force PostgREST schema cache reload
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Verification queries (run these after migration):
--
-- SELECT * FROM public.app_admins;
-- SELECT is_app_admin();   -- run as gowtham.aidata@gmail.com → true
-- SELECT COUNT(*) FROM public.categories WHERE user_id = (SELECT id FROM profiles LIMIT 1);
-- ============================================================
