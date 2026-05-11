-- Re-grant EXECUTE on clone_template_for_user to authenticated (SECURITY DEFINER, only writes for the calling user)
GRANT EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated;

-- Update handle_new_user to mark profile as initialized after clone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, has_been_initialized)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  BEGIN
    PERFORM public.clone_template_for_user(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Template clone failed for user %: %', NEW.id, SQLERRM;
    INSERT INTO public.portfolios (id, user_id, name, created_at, is_template)
    SELECT gen_random_uuid(), NEW.id, 'My Portfolio', now(), false
    WHERE NOT EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.user_id = NEW.id AND p.is_template = false
    );
  END;

  -- Mark profile as initialized so client-side init does not re-run
  UPDATE public.profiles SET has_been_initialized = true WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Backfill: mark existing users who already have a portfolio as initialized
UPDATE public.profiles p
SET has_been_initialized = true
WHERE has_been_initialized = false
  AND EXISTS (SELECT 1 FROM public.portfolios po WHERE po.user_id = p.id);
