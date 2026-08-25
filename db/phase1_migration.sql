-- ============================================================
-- LEDGR Phase 1 Migration: Schema fixes, category alignment,
-- admin roles, RPC overloads, audit_log security
-- Run this AFTER v1 migration and v2 fix
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix seed_default_categories() to match exact 14+5 spec
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS trigger AS $$
BEGIN
  -- 14 Expense categories (exact spec)
  INSERT INTO categories (user_id, name, type, icon, color) VALUES
    (NEW.id, 'Food',                'expense', '🍽️', '#ef4444'),
    (NEW.id, 'Rent',                'expense', '🏠', '#6366f1'),
    (NEW.id, 'Loan/EMI',           'expense', '🏦', '#78716c'),
    (NEW.id, 'Bills',              'expense', '💡', '#f59e0b'),
    (NEW.id, 'Transport',          'expense', '🚗', '#eab308'),
    (NEW.id, 'Shopping',           'expense', '🛍️', '#ec4899'),
    (NEW.id, 'Health',             'expense', '💊', '#14b8a6'),
    (NEW.id, 'Travel',             'expense', '✈️', '#06b6d4'),
    (NEW.id, 'Family & Gifts',    'expense', '🎁', '#fb923c'),
    (NEW.id, 'Education',          'expense', '📚', '#0ea5e9'),
    (NEW.id, 'Personal',           'expense', '💇', '#f472b6'),
    (NEW.id, 'Entertainment',      'expense', '🎬', '#a855f7'),
    (NEW.id, 'Savings & Investment','expense', '📈', '#22c55e'),
    (NEW.id, 'Other',              'expense', '📦', '#9ca3af');

  -- 5 Income categories (exact spec)
  INSERT INTO categories (user_id, name, type, icon, color) VALUES
    (NEW.id, 'Salary',              'income', '💰', '#10b981'),
    (NEW.id, 'Interest',            'income', '🏦', '#3b82f6'),
    (NEW.id, 'Trading/Investment Income', 'income', '📊', '#8b5cf6'),
    (NEW.id, 'Bonus',               'income', '🎉', '#f59e0b'),
    (NEW.id, 'Other',               'income', '📦', '#9ca3af');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Add missing columns to goals table
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'notes'
  ) THEN
    ALTER TABLE goals ADD COLUMN notes text;
  END IF;
END $$;

-- ============================================================
-- 3. Fix recurring_transactions schema
--    Add start_date if missing, rename next_date -> next_due_date
-- ============================================================

DO $$ BEGIN
  -- Add start_date if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN start_date date DEFAULT CURRENT_DATE;
  END IF;

  -- If next_date exists but next_due_date does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'next_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'next_due_date'
  ) THEN
    ALTER TABLE recurring_transactions RENAME COLUMN next_date TO next_due_date;
  END IF;

  -- If neither exists, add next_due_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'next_due_date'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN next_due_date date DEFAULT CURRENT_DATE;
  END IF;

  -- Add description if missing (frontend uses this)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN description text;
  END IF;
END $$;

-- ============================================================
-- 4. Create get_today_summary overload that accepts a date
-- ============================================================

-- Drop existing function first if it takes no args
DROP FUNCTION IF EXISTS get_today_summary();

-- Create the function that accepts an optional date parameter
CREATE OR REPLACE FUNCTION get_today_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_spent', COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'total_income', COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'daily_average', (
      SELECT COALESCE(AVG(daily_total), 0)
      FROM (
        SELECT SUM(amount) as daily_total
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
    'total_spent', 0,
    'total_income', 0,
    'transaction_count', 0,
    'daily_average', 0
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Fix get_monthly_summary to work with no params too
--    (Dashboard calls it with no params)
-- ============================================================

-- Drop existing versions
DROP FUNCTION IF EXISTS get_monthly_summary();
DROP FUNCTION IF EXISTS get_monthly_summary(int, int);

CREATE OR REPLACE FUNCTION get_monthly_summary(
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_month int DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int
)
RETURNS json AS $$
DECLARE
  result json;
  month_start date;
  month_end date;
BEGIN
  month_start := make_date(p_year, p_month, 1);
  month_end := (month_start + INTERVAL '1 month - 1 day')::date;

  SELECT json_build_object(
    'total_income', COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    'total_expenses', COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'total_expense', COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'month', p_month,
    'year', p_year
  ) INTO result
  FROM transactions
  WHERE user_id = auth.uid()
    AND transaction_date >= month_start
    AND transaction_date <= month_end;

  RETURN COALESCE(result, json_build_object(
    'total_income', 0,
    'total_expenses', 0,
    'total_expense', 0,
    'transaction_count', 0,
    'month', p_month,
    'year', p_year
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Fix get_daily_spending to return 'date' column alias
--    (Frontend reads d.date, not d.day)
-- ============================================================

DROP FUNCTION IF EXISTS get_daily_spending(date, date);

CREATE OR REPLACE FUNCTION get_daily_spending(p_start date, p_end date)
RETURNS TABLE(date date, total numeric) AS $$
BEGIN
  RETURN QUERY
    SELECT transaction_date AS date,
           SUM(amount) AS total
    FROM transactions
    WHERE user_id = auth.uid()
      AND type = 'expense'
      AND transaction_date >= p_start
      AND transaction_date <= p_end
    GROUP BY transaction_date
    ORDER BY transaction_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Fix get_category_spending to return BOTH expense and income
--    (so Insights can compute income too)
-- ============================================================

DROP FUNCTION IF EXISTS get_category_spending(date, date);

CREATE OR REPLACE FUNCTION get_category_spending(p_start date, p_end date)
RETURNS TABLE(category_name text, total numeric, type text) AS $$
BEGIN
  RETURN QUERY
    SELECT c.name AS category_name,
           SUM(t.amount) AS total,
           t.type
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = auth.uid()
      AND t.transaction_date >= p_start
      AND t.transaction_date <= p_end
    GROUP BY c.name, t.type
    ORDER BY SUM(t.amount) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Add role column to app_admins (email-based table)
--    app_admins schema: id (uuid PK), email (text UNIQUE), created_at
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support');
  END IF;
END $$;

-- Add role column to app_admins if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_admins' AND column_name = 'role'
  ) THEN
    ALTER TABLE app_admins ADD COLUMN role admin_role DEFAULT 'admin';
  END IF;
END $$;

-- ============================================================
-- 9. Fix audit_log INSERT policy — restrict to trigger-based inserts
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can insert their own audit entries" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

-- Audit log entries should only be created by triggers (SECURITY DEFINER functions)
-- No direct user INSERT access
-- The existing trigger functions run as SECURITY DEFINER so they bypass RLS

-- ============================================================
-- 10. Fix audit_log SELECT policy for admins
--     Admins should see all audit_log entries
--     NOTE: app_admins uses email column, NOT user_id
-- ============================================================

-- Drop existing select policy
DROP POLICY IF EXISTS "Users can view their own audit entries" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;

-- Users see their own entries
CREATE POLICY "audit_log_select_own"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Admins see all entries (check by email)
CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================================
-- 11. Admin RPC: get all users (for admin panel user management)
--     Admin check uses email, not user_id
-- ============================================================

CREATE OR REPLACE FUNCTION admin_list_users(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  onboarding_completed boolean,
  transaction_count bigint,
  last_active timestamptz
) AS $$
BEGIN
  -- Verify caller is admin (by email)
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      p.id AS user_id,
      au.email::text,
      p.full_name,
      p.created_at,
      p.onboarding_completed,
      (SELECT COUNT(*) FROM transactions t WHERE t.user_id = p.id) AS transaction_count,
      (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id) AS last_active
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. Admin RPC: search users
-- ============================================================

CREATE OR REPLACE FUNCTION admin_search_users(p_query text)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz
) AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      p.id AS user_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. Insert gowtham.aidata@gmail.com as Super Admin
--     app_admins uses (email, role), NOT (user_id, role)
-- ============================================================

INSERT INTO app_admins (email, role)
SELECT au.email, 'super_admin'::admin_role
FROM auth.users au
WHERE au.email = 'gowtham.aidata@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM app_admins aa WHERE aa.email = au.email
  );

-- Update existing entry to super_admin if already present
UPDATE app_admins
SET role = 'super_admin'::admin_role
WHERE email = 'gowtham.aidata@gmail.com'
  AND (role IS NULL OR role != 'super_admin');

-- ============================================================
-- 14. Fix admin_stats to return more useful stats
-- ============================================================

DROP FUNCTION IF EXISTS admin_stats();

CREATE OR REPLACE FUNCTION admin_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_transactions', (SELECT COUNT(*) FROM transactions),
    'total_categories', (SELECT COUNT(*) FROM categories),
    'total_accounts', (SELECT COUNT(*) FROM accounts),
    'users_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'transactions_today', (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 15. Fix admin_recent_activity to use proper column aliases
-- ============================================================

DROP FUNCTION IF EXISTS admin_recent_activity(int);

CREATE OR REPLACE FUNCTION admin_recent_activity(p_limit int DEFAULT 20)
RETURNS TABLE(
  email text,
  action text,
  created_at timestamptz
) AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    (
      -- Recent signups
      SELECT
        au.email::text,
        'signup'::text AS action,
        p.created_at
      FROM profiles p
      JOIN auth.users au ON au.id = p.id
      ORDER BY p.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      -- Recent transactions
      SELECT
        au.email::text,
        ('added ' || t.type)::text AS action,
        t.created_at
      FROM transactions t
      JOIN auth.users au ON au.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT p_limit
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 16. Create delete_user_data RPC for account deletion
--     app_admins uses email, not user_id
-- ============================================================

CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS void AS $$
DECLARE
  uid uuid;
  user_email text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the user's email for app_admins cleanup
  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  -- Delete in order respecting foreign keys
  DELETE FROM budgets WHERE user_id = uid;
  DELETE FROM goals WHERE user_id = uid;
  DELETE FROM recurring_transactions WHERE user_id = uid;
  DELETE FROM transactions WHERE user_id = uid;
  DELETE FROM categories WHERE user_id = uid;
  DELETE FROM accounts WHERE user_id = uid;
  DELETE FROM audit_log WHERE user_id = uid;
  DELETE FROM app_admins WHERE email = user_email;
  DELETE FROM profiles WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 17. Add reviewed_dates column to profiles for DailyReview persistence
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_dates TEXT[] DEFAULT '{}';

COMMIT;
