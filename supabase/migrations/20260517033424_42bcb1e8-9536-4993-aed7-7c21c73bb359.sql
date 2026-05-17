
DROP POLICY IF EXISTS "Users can view own dividends" ON public.dividends;
DROP POLICY IF EXISTS "Users can insert own dividends" ON public.dividends;
DROP POLICY IF EXISTS "Users can update own dividends" ON public.dividends;
DROP POLICY IF EXISTS "Users can delete own dividends" ON public.dividends;

CREATE POLICY "Users can view own dividends" ON public.dividends
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dividends" ON public.dividends
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dividends" ON public.dividends
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dividends" ON public.dividends
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_dividends_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
