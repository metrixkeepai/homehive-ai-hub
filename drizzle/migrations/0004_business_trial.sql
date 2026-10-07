ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
CREATE OR REPLACE FUNCTION public.start_business_trial() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT trial_ends_at INTO t FROM profiles WHERE id = auth.uid();
  IF t IS NOT NULL THEN RAISE EXCEPTION 'trial already used'; END IF;
  UPDATE profiles SET plan = 'business_starter', plan_source = 'trial', trial_ends_at = now() + interval '14 days' WHERE id = auth.uid() RETURNING trial_ends_at INTO t;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.start_business_trial() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_business_trial() TO authenticated;