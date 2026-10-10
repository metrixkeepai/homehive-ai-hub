CREATE TABLE public.plan_status (plan_key text PRIMARY KEY, active boolean NOT NULL DEFAULT true, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.plan_status TO anon, authenticated;
GRANT ALL ON public.plan_status TO service_role;
ALTER TABLE public.plan_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan status public read" ON public.plan_status FOR SELECT TO anon, authenticated USING (true);