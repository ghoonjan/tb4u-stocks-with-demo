-- Validation trigger to ensure profiles always have email + full_name
CREATE OR REPLACE FUNCTION public.profiles_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'profiles.email cannot be null or empty'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.full_name IS NULL OR btrim(NEW.full_name) = '' THEN
    RAISE EXCEPTION 'profiles.full_name cannot be null or empty'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_trigger ON public.profiles;
CREATE TRIGGER profiles_validate_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_validate();