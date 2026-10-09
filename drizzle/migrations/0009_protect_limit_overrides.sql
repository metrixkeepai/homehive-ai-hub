CREATE OR REPLACE FUNCTION public.protect_limit_overrides() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.limit_overrides IS DISTINCT FROM OLD.limit_overrides AND coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.limit_overrides := OLD.limit_overrides;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_limit_overrides BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_limit_overrides();