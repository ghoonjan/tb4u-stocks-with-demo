CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  holdings_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(p.email, u.email)::text AS email,
    p.full_name,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    COALESCE((
      SELECT count(*) FROM public.holdings h
      JOIN public.portfolios po ON po.id = h.portfolio_id
      WHERE po.user_id = p.id AND po.is_template = false
    ), 0) AS holdings_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;