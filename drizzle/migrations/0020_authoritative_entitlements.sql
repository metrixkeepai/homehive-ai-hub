CREATE FUNCTION public.account_entitlements(_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; key text; result jsonb; published jsonb;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user;
  IF NOT FOUND OR p.suspended THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501'; END IF;
  key := p.plan;
  IF (p.plan_source = 'trial' AND (p.trial_ends_at IS NULL OR p.trial_ends_at <= now()))
    OR (p.plan_source LIKE 'voucher:%' AND p.voucher_ends_at IS NOT NULL AND p.voucher_ends_at <= now()) THEN key := 'free'; END IF;
  SELECT entitlements INTO result FROM public.plan_defaults WHERE plan_key = key;
  IF result IS NULL THEN RAISE EXCEPTION 'Plan unavailable' USING ERRCODE = '42501'; END IF;
  SELECT entitlements INTO published FROM public.plan_versions
    WHERE plan_key = key AND status = 'approved' AND entitlements IS NOT NULL ORDER BY version DESC LIMIT 1;
  result := result || coalesce(published, '{}'::jsonb);
  -- Only service-role controlled overrides; retain the feature on/off state.
  IF p.limit_overrides ? 'assets' THEN result := jsonb_set(result, '{assets,limit}', p.limit_overrides->'assets'); END IF;
  IF p.limit_overrides ? 'docs' THEN result := jsonb_set(result, '{documents,limit}', p.limit_overrides->'docs'); END IF;
  IF p.limit_overrides ? 'storage' THEN
    result := jsonb_set(result, '{storage,limit}', to_jsonb((p.limit_overrides->>'storage')::numeric / 1048576));
    result := jsonb_set(result, '{storage,unit}', '"MB"');
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.account_entitlements(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_entitlements(uuid) TO service_role;

CREATE FUNCTION public.enforce_item_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature text; cap numeric; used bigint; cfg jsonb;
BEGIN
  -- Stable lock serializes concurrent inserts and moves across all of an account's workspaces.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 1));
  IF NEW.workspace_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND owner_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.section IS DISTINCT FROM OLD.section) THEN
    RAISE EXCEPTION 'Record scope is immutable' USING ERRCODE = '42501';
  END IF;
  ent := public.account_entitlements(NEW.user_id);
  IF octet_length(NEW.fields::text) > 65536 OR jsonb_typeof(NEW.fields) <> 'array' THEN RAISE EXCEPTION 'Invalid record fields'; END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  feature := CASE NEW.section
    WHEN 'my-home' THEN 'properties' WHEN 'properties' THEN 'properties'
    WHEN 'rooms' THEN 'rooms' WHEN 'assets' THEN 'assets' WHEN 'equipment' THEN 'equipment'
    WHEN 'vehicles' THEN 'vehicles' WHEN 'documents' THEN 'documents' WHEN 'locations' THEN 'locations'
    WHEN 'team' THEN 'users' WHEN 'family' THEN 'users' WHEN 'departments' THEN 'departments'
    WHEN 'insurance' THEN 'insurance_evidence_inventory'
    WHEN 'contracts' THEN 'contract_management' WHEN 'certificates' THEN 'certificate_tracking'
    WHEN 'suppliers' THEN 'supplier_records'
    WHEN 'warranties' THEN 'assets' WHEN 'renewals' THEN 'assets'
    WHEN 'maintenance' THEN 'assets' WHEN 'tasks' THEN 'assets'
    ELSE NULL END;
  IF feature IS NULL THEN RAISE EXCEPTION 'This record type is not available' USING ERRCODE = '42501'; END IF;
  cfg := ent->feature;
  IF coalesce((cfg->>'on')::boolean, false) = false THEN RAISE EXCEPTION 'Plan feature unavailable' USING ERRCODE = '42501'; END IF;
  IF cfg->>'limit' IS NOT NULL THEN
    cap := (cfg->>'limit')::numeric;
    IF cap < 0 THEN RAISE EXCEPTION 'Invalid plan capacity'; END IF;
    SELECT count(*) INTO used FROM public.home_items WHERE user_id = NEW.user_id
      AND (section = NEW.section OR (feature = 'properties' AND section IN ('my-home','properties')));
    IF used >= cap THEN RAISE EXCEPTION 'Plan capacity reached' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_item_capacity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER home_items_capacity BEFORE INSERT OR UPDATE ON public.home_items FOR EACH ROW EXECUTE FUNCTION public.enforce_item_capacity();

CREATE TABLE public.operation_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, workspace_id uuid,
  feature text NOT NULL, units integer NOT NULL CHECK (units > 0), reserved_usd numeric NOT NULL CHECK (reserved_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operation_reservations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.operation_reservations TO service_role;
CREATE INDEX operation_reservations_account_feature_time ON public.operation_reservations(user_id, feature, created_at);
CREATE INDEX operation_reservations_time ON public.operation_reservations(created_at);
CREATE TABLE public.runtime_limits (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  ai_enabled boolean NOT NULL DEFAULT false,
  daily_ai_budget_usd numeric NOT NULL CHECK (daily_ai_budget_usd > 0),
  requests_per_minute integer NOT NULL CHECK (requests_per_minute BETWEEN 1 AND 60)
);
ALTER TABLE public.runtime_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.runtime_limits TO service_role;
INSERT INTO public.runtime_limits VALUES (true, false, 10, 10);

-- Service-only: handlers supply the verified identity and feature, never accept these from caller metadata.
-- Reservations are charged on attempts, including upstream errors; there is no client refund/replay loophole.
CREATE FUNCTION public.reserve_operation(_user uuid, _workspace uuid, _feature text, _units integer DEFAULT 1) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
  IF _units < 1 OR _units > 5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
  PERFORM pg_advisory_xact_lock(8102026);
  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 1));
  ent := public.account_entitlements(_user);
  IF _workspace IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace AND owner_id = _user) THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501'; END IF;
  feature_key := CASE _feature WHEN 'capture' THEN 'ai_captures' WHEN 'video' THEN 'room_video_scans'
    WHEN 'sera' THEN 'sera_questions' WHEN 'speech' THEN 'ai_captures' WHEN 'voice' THEN 'sera_voice_minutes'
    WHEN 'share' THEN 'secure_shares' WHEN 'report' THEN 'basic_reports' ELSE NULL END;
  IF feature_key IS NULL OR NOT coalesce((ent->feature_key->>'on')::boolean, false) THEN RAISE EXCEPTION 'Plan feature unavailable' USING ERRCODE = '42501'; END IF;
  SELECT * INTO settings FROM public.runtime_limits WHERE singleton;
  IF NOT FOUND OR (NOT settings.ai_enabled AND _feature NOT IN ('share','report')) THEN RAISE EXCEPTION 'Service temporarily unavailable' USING ERRCODE = '42501'; END IF;
  SELECT count(*) INTO used FROM public.operation_reservations WHERE user_id = _user AND created_at > now() - interval '1 minute';
  IF used >= settings.requests_per_minute THEN RAISE EXCEPTION 'Rate limit reached' USING ERRCODE = '42501'; END IF;
  cap := (ent->feature_key->>'limit')::numeric;
  SELECT coalesce(sum(units),0) INTO used FROM public.operation_reservations WHERE user_id = _user
    AND (feature = _feature OR (feature_key = 'ai_captures' AND feature IN ('capture','speech')))
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF cap IS NOT NULL AND used + _units > cap THEN RAISE EXCEPTION 'Monthly quota reached' USING ERRCODE = '42501'; END IF;
  cost := CASE WHEN _feature IN ('share','report') THEN 0.000001 ELSE 1.0 * _units END;
  IF _feature NOT IN ('share','report') AND
    (SELECT coalesce(sum(reserved_usd),0) FROM public.operation_reservations WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + cost > settings.daily_ai_budget_usd THEN
    RAISE EXCEPTION 'Platform AI budget reached' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_operation(uuid,uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operation(uuid,uuid,text,integer) TO service_role;
