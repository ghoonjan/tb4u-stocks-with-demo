
-- 1. profiles: add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS has_been_initialized BOOLEAN NOT NULL DEFAULT false;

-- 2. portfolios: add template flag
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- 3. update handle_new_user to explicitly set has_been_initialized
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, has_been_initialized)
  VALUES (NEW.id, NEW.email, false);

  INSERT INTO public.portfolios (user_id, name)
  VALUES (NEW.id, 'My Portfolio');

  RETURN NEW;
END;
$function$;

-- 4. backfill admin
DO $$
DECLARE
  admin_id uuid;
  admin_portfolio_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'saxplayingurd@gmail.com' LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles
    SET has_been_initialized = true
    WHERE id = admin_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'super_admin')
    ON CONFLICT DO NOTHING;

    SELECT id INTO admin_portfolio_id
    FROM public.portfolios
    WHERE user_id = admin_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF admin_portfolio_id IS NOT NULL THEN
      UPDATE public.portfolios
      SET is_template = true
      WHERE id = admin_portfolio_id;
    END IF;
  END IF;
END $$;
