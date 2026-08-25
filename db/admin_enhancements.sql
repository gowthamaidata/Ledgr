-- ============================================================
-- LEDGR — Admin Enhancement SQL
-- Run in Supabase SQL Editor AFTER final_complete_migration.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Admin: Set temporary password for a user
--    Only callable by users with admin email
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_temp_password(
  p_user_id uuid,
  p_password text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  -- Validate password length
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  -- Use Supabase admin function to update user password
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'admin_set_temp_password',
    'user',
    p_user_id,
    json_build_object('admin_email', (SELECT email FROM auth.users WHERE id = auth.uid()))
  );
END;
$$;

-- ============================================================
-- 2. Admin: Get all transactions across all users (paginated)
--    Returns full transaction details for admin inspection
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_list_all_transactions(int, int, text, text);

CREATE OR REPLACE FUNCTION public.admin_list_all_transactions(
  p_limit    int  DEFAULT 25,
  p_offset   int  DEFAULT 0,
  p_type     text DEFAULT NULL,  -- 'expense'|'income'|'transfer'|NULL for all
  p_search   text DEFAULT NULL   -- search party/notes
)
RETURNS TABLE(
  id                    uuid,
  user_id               uuid,
  user_email            text,
  user_name             text,
  account_name          text,
  category_name         text,
  type                  text,
  amount                numeric,
  party                 text,
  notes                 text,
  payment_method        text,
  transaction_date      date,
  created_at            timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  RETURN QUERY
    SELECT
      t.id,
      t.user_id,
      au.email::text,
      p.full_name,
      acc.name,
      c.name,
      t.type,
      t.amount,
      t.party,
      t.notes,
      t.payment_method,
      t.transaction_date,
      t.created_at
    FROM transactions t
    LEFT JOIN auth.users au ON au.id = t.user_id
    LEFT JOIN profiles p ON p.id = t.user_id
    LEFT JOIN accounts acc ON acc.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE
      (p_type IS NULL OR t.type = p_type)
      AND (
        p_search IS NULL
        OR t.party ILIKE '%' || p_search || '%'
        OR t.notes ILIKE '%' || p_search || '%'
        OR c.name ILIKE '%' || p_search || '%'
        OR au.email ILIKE '%' || p_search || '%'
        OR p.full_name ILIKE '%' || p_search || '%'
      )
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================
-- 3. Admin: Get user financial summary (for user detail modal)
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_get_user_stats(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_user_stats(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE result json;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Access denied: not an admin';
  END IF;

  SELECT json_build_object(
    'total_transactions', (SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id),
    'total_expense', (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = p_user_id AND type = 'expense'),
    'total_income',  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = p_user_id AND type = 'income'),
    'budgets',       (SELECT COUNT(*) FROM budgets WHERE user_id = p_user_id),
    'accounts',      (SELECT COUNT(*) FROM accounts WHERE user_id = p_user_id AND is_active = true),
    'goals',         (SELECT COUNT(*) FROM goals WHERE user_id = p_user_id),
    'last_transaction', (SELECT MAX(created_at) FROM transactions WHERE user_id = p_user_id)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 4. Audit log: Allow admins to insert entries
--    (needed for admin actions like password reset logging)
-- ============================================================

DROP POLICY IF EXISTS "audit_log_insert_admin" ON audit_log;

CREATE POLICY "audit_log_insert_admin" ON audit_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================
-- 5. admin_list_users: Add last_sign_in_at from auth.users
-- ============================================================

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
  last_active          timestamptz,
  role                 text
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
      (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id),
      COALESCE(adm.role::text, 'user')
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    LEFT JOIN app_admins adm ON adm.email = au.email
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================
-- 6. admin_search_users: Enhanced with role info
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_search_users(text);

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(
  user_id              uuid,
  email                text,
  full_name            text,
  created_at           timestamptz,
  onboarding_completed boolean,
  transaction_count    bigint,
  last_active          timestamptz,
  role                 text
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
      (SELECT MAX(t.created_at) FROM transactions t WHERE t.user_id = p.id),
      COALESCE(adm.role::text, 'user')
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    LEFT JOIN app_admins adm ON adm.email = au.email
    WHERE au.email ILIKE '%' || p_query || '%'
       OR p.full_name ILIKE '%' || p_query || '%'
    ORDER BY p.created_at DESC
    LIMIT 20;
END;
$$;

-- ============================================================
-- 7. Force schema cache reload
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Verification:
-- SELECT public.is_app_admin();  -- should be true for gowtham
-- SELECT * FROM public.admin_list_users();
-- SELECT * FROM public.admin_list_all_transactions(10, 0, NULL, NULL);
-- ============================================================
