-- ============================================================
-- LEDGR — Admin User Stats RPC (SECURITY DEFINER)
-- Allows admins to read another user's financial stats
-- WITHOUT exposing those stats to regular users.
--
-- Security model:
--   1. Caller must appear in app_admins table (checked by is_app_admin())
--   2. Function runs as the Postgres role that owns it (bypasses RLS)
--   3. Regular users get NULL / exception — NOT another user's data
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- Drop old versions first
DROP FUNCTION IF EXISTS public.admin_get_user_stats(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Gate: must be an admin
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  SELECT json_build_object(
    'total_transactions', (
      SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id
    ),
    'total_expense', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = p_user_id AND type = 'expense'
    ),
    'total_income', (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE user_id = p_user_id AND type = 'income'
    ),
    'budgets', (
      SELECT COUNT(*) FROM budgets WHERE user_id = p_user_id AND is_active = true
    ),
    'accounts', (
      SELECT COUNT(*) FROM accounts WHERE user_id = p_user_id AND is_active = true
    ),
    'goals', (
      SELECT COUNT(*) FROM goals WHERE user_id = p_user_id
    ),
    'last_transaction', (
      SELECT MAX(transaction_date) FROM transactions WHERE user_id = p_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute only to authenticated users (the is_app_admin() check handles auth)
REVOKE ALL ON FUNCTION public.admin_get_user_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_stats(uuid) TO authenticated;

-- ============================================================
-- Admin: get recent transactions for a specific user
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_user_transactions(uuid, int);

CREATE OR REPLACE FUNCTION public.admin_get_user_transactions(
  p_user_id uuid,
  p_limit   int DEFAULT 15
)
RETURNS TABLE(
  id               uuid,
  type             text,
  amount           numeric,
  party            text,
  notes            text,
  transaction_date date,
  created_at       timestamptz,
  category_name    text,
  account_name     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      t.id,
      t.type,
      t.amount,
      t.party,
      t.notes,
      t.transaction_date,
      t.created_at,
      c.name  AS category_name,
      a.name  AS account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts   a ON a.id = t.account_id
    WHERE t.user_id = p_user_id
    ORDER BY t.transaction_date DESC, t.created_at DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_transactions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_transactions(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
