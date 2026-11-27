REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, avatar_url, household, account_type, org_name, sector,
  job_title, phone, language, currency, timezone, country, bio, business_type,
  org_size, branches, updated_at) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;

CREATE TABLE public.trial_history (
  user_id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  CONSTRAINT trial_dates CHECK (ended_at >= started_at)
);
ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trial_history TO authenticated;
GRANT SELECT, INSERT ON public.trial_history TO service_role;
CREATE POLICY "own trial history" ON public.trial_history FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.trial_history (user_id, started_at, ended_at)
SELECT id, trial_ends_at - interval '14 days', trial_ends_at FROM public.profiles
WHERE trial_ends_at IS NOT NULL ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.start_business_trial() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; expiry timestamptz := now() + interval '14 days';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR p.suspended OR p.account_type NOT IN ('business', 'enterprise') THEN
    RAISE EXCEPTION 'Trial unavailable' USING ERRCODE = '42501';
  END IF;
  IF p.plan <> 'free' OR p.trial_ends_at IS NOT NULL OR EXISTS
    (SELECT 1 FROM public.trial_history WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Trial unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.trial_history VALUES (auth.uid(), now(), expiry);
  UPDATE public.profiles SET plan = 'business_starter', plan_source = 'trial',
    trial_ends_at = expiry, updated_at = now() WHERE id = auth.uid();
  RETURN expiry;
END $$;
REVOKE ALL ON FUNCTION public.start_business_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_business_trial() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (auth.role() = 'service_role' OR _user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (auth.role() = 'service_role' OR user_uuid = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = user_uuid AND environment = check_env
    AND ((status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())))
$$;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_workspace(_workspace uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND NOT suspended)
    AND (_workspace IS NULL OR EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace AND owner_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.can_access_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(uuid) TO authenticated, service_role;

DROP POLICY "own items select" ON public.home_items;
DROP POLICY "own items insert" ON public.home_items;
DROP POLICY "own items update" ON public.home_items;
DROP POLICY "own items delete" ON public.home_items;
CREATE POLICY "authorised workspace items" ON public.home_items FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.can_access_workspace(workspace_id))
WITH CHECK (user_id = auth.uid() AND public.can_access_workspace(workspace_id));

DROP POLICY "own workspaces" ON public.workspaces;
CREATE POLICY "active owner workspaces" ON public.workspaces FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.can_access_workspace(NULL))
WITH CHECK (owner_id = auth.uid() AND public.can_access_workspace(NULL));

DROP POLICY "own evidence all" ON public.evidence_files;
CREATE POLICY "authorised evidence" ON public.evidence_files FOR ALL TO authenticated
USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.home_items i WHERE i.id = item_id AND i.user_id = auth.uid()))
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.home_items i WHERE i.id = item_id AND i.user_id = auth.uid())
  AND split_part(path, '/', 1) = auth.uid()::text AND size >= 0);

DROP POLICY "own links all" ON public.record_links;
CREATE POLICY "authorised record links" ON public.record_links FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.can_access_workspace(workspace_id))
WITH CHECK (user_id = auth.uid() AND public.can_access_workspace(workspace_id)
  AND EXISTS (SELECT 1 FROM public.home_items i WHERE i.id = source_item_id AND i.workspace_id IS NOT DISTINCT FROM record_links.workspace_id)
  AND EXISTS (SELECT 1 FROM public.home_items i WHERE i.id = target_item_id AND i.workspace_id IS NOT DISTINCT FROM record_links.workspace_id)
  AND (source_document_id IS NULL OR EXISTS (SELECT 1 FROM public.home_items i WHERE i.id = source_document_id AND i.workspace_id IS NOT DISTINCT FROM record_links.workspace_id)));

CREATE INDEX home_items_workspace_section_created ON public.home_items (user_id, workspace_id, section, created_at DESC, id);
CREATE INDEX evidence_files_user_item ON public.evidence_files (user_id, item_id);