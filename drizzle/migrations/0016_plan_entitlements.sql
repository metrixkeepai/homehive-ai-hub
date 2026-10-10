ALTER TABLE public.plan_versions ADD COLUMN entitlements jsonb;
CREATE OR REPLACE FUNCTION public.published_plan_entitlements()
RETURNS TABLE(plan_key text, entitlements jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (v.plan_key) v.plan_key, v.entitlements FROM public.plan_versions v
  WHERE v.status = 'approved' AND v.entitlements IS NOT NULL ORDER BY v.plan_key, v.version DESC
$$;
GRANT EXECUTE ON FUNCTION public.published_plan_entitlements() TO anon, authenticated;