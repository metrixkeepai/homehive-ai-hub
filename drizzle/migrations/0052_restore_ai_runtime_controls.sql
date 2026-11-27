-- Restore the certified implementation deferred in 0028_evidence_upload_storage_fix.sql.
-- Supabase Storage inserts objects with partial metadata (mimetype + contentLength),
-- then updates with full metadata including size. The capacity trigger must allow
-- that INSERT and validate size on UPDATE (or when size/contentLength is present).
CREATE OR REPLACE FUNCTION public.enforce_storage_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, pg_temp AS $$
DECLARE
  uid uuid;
  item uuid;
  ent jsonb;
  cap numeric;
  used numeric;
  bytes bigint;
  mime text;
  size_txt text;
BEGIN
  IF NEW.bucket_id <> 'evidence' THEN RETURN NEW; END IF;
  uid := split_part(NEW.name, '/', 1)::uuid;
  item := split_part(NEW.name, '/', 2)::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  ent := public.account_entitlements(uid);
  IF NOT EXISTS (SELECT 1 FROM public.home_items WHERE id = item AND user_id = uid) THEN
    RAISE EXCEPTION 'Upload record unavailable' USING ERRCODE = '42501';
  END IF;

  size_txt := coalesce(NEW.metadata->>'size', NEW.metadata->>'contentLength', '');
  -- Storage's first write often has no size yet; validate on the later UPDATE.
  IF size_txt = '' AND TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF size_txt !~ '^[0-9]{1,10}$' THEN RAISE EXCEPTION 'Upload size unavailable'; END IF;

  bytes := size_txt::bigint;
  mime := NEW.metadata->>'mimetype';
  IF bytes > 20971520 OR bytes <= 0
    OR mime NOT IN (
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'text/plain'
    )
    OR mime IS NULL
  THEN
    RAISE EXCEPTION 'Unsupported upload';
  END IF;
  IF NOT coalesce((ent->'storage'->>'on')::boolean, false) THEN
    RAISE EXCEPTION 'Storage unavailable' USING ERRCODE = '42501';
  END IF;
  cap := (ent->'storage'->>'limit')::numeric * CASE ent->'storage'->>'unit'
    WHEN 'MB' THEN 1048576
    WHEN 'GB' THEN 1073741824
    WHEN 'TB' THEN 1099511627776
    ELSE 0
  END;
  SELECT coalesce(sum(coalesce((metadata->>'size')::numeric, (metadata->>'contentLength')::numeric, 0)), 0)
    INTO used
  FROM storage.objects
  WHERE bucket_id = 'evidence'
    AND split_part(name, '/', 1) = uid::text
    AND id IS DISTINCT FROM NEW.id;
  IF cap IS NOT NULL AND used + bytes > cap THEN
    RAISE EXCEPTION 'Storage quota reached' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Storage updates object metadata after INSERT; allow owners to UPDATE their evidence objects.
DROP POLICY IF EXISTS "own evidence update" ON storage.objects;
CREATE POLICY "own evidence update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'evidence' AND split_part(name, '/', 1) = auth.uid()::text AND public.can_access_workspace(NULL))
WITH CHECK (bucket_id = 'evidence' AND split_part(name, '/', 1) = auth.uid()::text AND public.can_access_workspace(NULL));

-- Restore the certified implementation deferred in 0030_restore_runtime_guards.sql.
CREATE OR REPLACE FUNCTION public.feature_enabled(_user uuid,_key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.feature_flags; audience text; h bigint:=0; c text;
BEGIN
 SELECT account_type INTO audience FROM public.profiles WHERE id=_user AND NOT suspended;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO f FROM public.feature_flags WHERE key=_key;
 IF NOT FOUND OR NOT f.enabled OR (cardinality(f.audiences)>0 AND NOT audience=ANY(f.audiences)) THEN RETURN false; END IF;
 FOREACH c IN ARRAY regexp_split_to_array(_user::text,'') LOOP h:=mod(h*31+ascii(c),4294967296); END LOOP;
 RETURN mod(h,100)<f.rollout;
END $$;
REVOKE ALL ON FUNCTION public.feature_enabled(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.feature_enabled(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_operation(_user uuid, _workspace uuid, _feature text, _units integer DEFAULT 1) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
  IF _units < 1 OR _units > 5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
  PERFORM pg_advisory_xact_lock(8102026);
  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 1));
  ent := public.account_entitlements(_user);
  IF NOT public.feature_enabled(_user,CASE _feature
    WHEN 'capture' THEN 'capture_ai' WHEN 'video' THEN 'capture_ai' WHEN 'sera' THEN 'sera_text'
    WHEN 'speech' THEN 'speech_capture' WHEN 'voice' THEN 'sera_voice' WHEN 'share' THEN 'passport_shares'
    ELSE 'unavailable' END) THEN RAISE EXCEPTION 'Feature temporarily unavailable' USING ERRCODE='42501'; END IF;
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

-- Preserve reservations written by migration 0026 before switching accounting tables.
INSERT INTO public.operation_reservations (id,user_id,workspace_id,feature,units,reserved_usd,created_at)
SELECT id,user_id,workspace_id,feature,units,
       CASE WHEN feature IN ('share','report') THEN 0.000001 ELSE units END,created_at
FROM public.operation_usage ON CONFLICT (id) DO NOTHING;

-- PostgREST resolves RPCs by argument names. Both overloads exposed the same names.
-- Keep the original environment-checked, ordered and idempotent billing implementation.
DROP FUNCTION public.apply_billing_event(text,bigint,text,text,boolean,jsonb);

-- Restore the certified implementation deferred in 0035_passport_share_access.sql.
-- Preview the same account and feature gates that the insert trigger enforces.
CREATE FUNCTION public.can_share_passport() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.feature_enabled(auth.uid(), 'passport_shares')
     AND coalesce((public.account_entitlements(auth.uid())->'secure_shares'->>'on')::boolean, false)
$$;
REVOKE ALL ON FUNCTION public.can_share_passport() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_share_passport() TO authenticated;

-- Restore the certified implementation deferred in 0036_ai_cost_controls.sql.
CREATE FUNCTION public.reserve_ai_operation(_user uuid, _workspace uuid, _feature text, _units integer, _estimate numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
  IF _estimate IS NULL OR _estimate <= 0 OR _estimate > 5 OR _units IS NULL OR _units < 1 OR _units > 5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
  PERFORM pg_advisory_xact_lock(8102026);
  PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 1));
  ent := public.account_entitlements(_user);
  IF NOT public.feature_enabled(_user,CASE _feature
    WHEN 'capture' THEN 'capture_ai' WHEN 'video' THEN 'capture_ai' WHEN 'sera' THEN 'sera_text'
    WHEN 'speech' THEN 'speech_capture' WHEN 'voice' THEN 'sera_voice' WHEN 'share' THEN 'passport_shares'
    ELSE 'unavailable' END) THEN RAISE EXCEPTION 'Feature temporarily unavailable' USING ERRCODE='42501'; END IF;
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
  cost := _estimate;
  IF _feature NOT IN ('share','report') AND
    (SELECT coalesce(sum(reserved_usd),0) FROM public.operation_reservations WHERE feature NOT IN ('share','report') AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + cost > settings.daily_ai_budget_usd THEN
    RAISE EXCEPTION 'Platform AI budget reached' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,integer,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,integer,numeric) TO service_role;

-- Preserve existing callers and security-definer passport triggers.
CREATE OR REPLACE FUNCTION public.reserve_operation(_user uuid,_workspace uuid,_feature text,_units integer DEFAULT 1) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.reserve_ai_operation(_user,_workspace,_feature,_units,
   CASE _feature WHEN 'voice' THEN 4.50 WHEN 'sera' THEN 0.002 WHEN 'speech' THEN 0.015
   WHEN 'video' THEN 0.02 WHEN 'capture' THEN 0.01 ELSE 0.000001 END)
$$;
CREATE INDEX IF NOT EXISTS operation_reservations_day ON public.operation_reservations(created_at);

ALTER TABLE public.ai_model_rates
 ADD COLUMN cached_input_per_million_usd numeric(10,5),
 ADD COLUMN write_per_million_usd numeric(10,5),
 ADD COLUMN audio_per_minute_usd numeric(10,6),
 ADD COLUMN processing_mode text NOT NULL DEFAULT 'default',
 ADD COLUMN provider text NOT NULL DEFAULT 'openai';
-- Standard endpoint, short context, no extended retention. Rates sourced 2026-11-21.
INSERT INTO public.ai_model_rates(model,input_per_million_usd,output_per_million_usd,cached_input_per_million_usd,write_per_million_usd,audio_per_minute_usd)
VALUES ('gpt-6-luna',0.10,0.50,0.01,0.125,NULL),('gpt-6.1-sol',2,10,0.1,2.5,NULL),('gpt-transcribe',0,0,NULL,NULL,0.0045)
ON CONFLICT(model) DO UPDATE SET cached_input_per_million_usd=excluded.cached_input_per_million_usd,
 write_per_million_usd=excluded.write_per_million_usd,audio_per_minute_usd=excluded.audio_per_minute_usd;
ALTER TABLE public.ai_usage_log ALTER COLUMN cost_usd TYPE numeric(18,10);
CREATE FUNCTION public.price_ai_usage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.ai_model_rates; reads int; writes int;
BEGIN
 IF NEW.usage_details->>'accounting_version' IS DISTINCT FROM '1' THEN RETURN NEW; END IF;
 SELECT * INTO STRICT r FROM public.ai_model_rates WHERE model=NEW.model;
 reads:=least(NEW.input_tokens,greatest(0,coalesce((NEW.usage_details->>'cached_tokens')::int,0)));
 writes:=least(NEW.input_tokens-reads,greatest(0,coalesce((NEW.usage_details->>'cache_write_tokens')::int,0)));
 NEW.cost_usd:=CASE WHEN r.audio_per_minute_usd IS NOT NULL THEN NEW.audio_seconds*r.audio_per_minute_usd/60
 ELSE ((NEW.input_tokens-reads-writes)*r.input_per_million_usd + reads*coalesce(r.cached_input_per_million_usd,r.input_per_million_usd)
 +writes*coalesce(r.write_per_million_usd,r.input_per_million_usd)+NEW.output_tokens*r.output_per_million_usd)/1000000 END;
 NEW.usage_details:=NEW.usage_details||jsonb_build_object('rates_effective_from',r.updated_at,'rate_snapshot',to_jsonb(r)-'updated_by',
 'cache_savings_usd',(reads*(r.input_per_million_usd-coalesce(r.cached_input_per_million_usd,r.input_per_million_usd))
 -writes*(coalesce(r.write_per_million_usd,r.input_per_million_usd)-r.input_per_million_usd))/1000000);
 RETURN NEW;
END $$;
CREATE TRIGGER price_ai_usage BEFORE INSERT ON public.ai_usage_log FOR EACH ROW EXECUTE FUNCTION public.price_ai_usage();

-- Keys include user and workspace in the server digest; re-check ownership on every hit.
CREATE TABLE public.ai_request_cache (
 key text PRIMARY KEY CHECK (length(key)=64), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, feature text NOT NULL,
 lease uuid NOT NULL, expires_at timestamptz NOT NULL, result jsonb, hits bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.ai_request_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_cache FROM PUBLIC,anon,authenticated;
CREATE INDEX ai_request_cache_expiry ON public.ai_request_cache(expires_at);
CREATE FUNCTION public.claim_ai_request(_key text,_user uuid,_workspace uuid,_feature text,_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE entry public.ai_request_cache; flag text; benefit text;
BEGIN
 SELECT f,b INTO flag,benefit FROM (VALUES
 ('capture','capture_ai','ai_captures'),('video','capture_ai','room_video_scans'),('sera','sera_text','sera_questions'),
 ('speech','speech_capture','ai_captures')) AS choices(k,f,b) WHERE k=_feature;
 IF flag IS NULL OR NOT public.feature_enabled(_user,flag)
 OR NOT coalesce((public.account_entitlements(_user)->benefit->>'on')::boolean,false)
 OR NOT EXISTS(SELECT 1 FROM public.runtime_limits WHERE singleton AND ai_enabled)
 OR (_workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user))
 THEN RAISE EXCEPTION 'AI unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_key,9));
 DELETE FROM public.ai_request_cache WHERE key IN
 (SELECT key FROM public.ai_request_cache WHERE expires_at<=now() ORDER BY expires_at LIMIT 20 FOR UPDATE SKIP LOCKED);
 DELETE FROM public.ai_request_cache WHERE key=_key AND expires_at<=now();
 SELECT * INTO entry FROM public.ai_request_cache WHERE key=_key;
 IF FOUND THEN
   IF entry.user_id<>_user OR entry.workspace_id IS DISTINCT FROM _workspace OR entry.feature<>_feature THEN RAISE EXCEPTION 'Cache scope mismatch'; END IF;
   IF entry.result IS NULL THEN RETURN '{"state":"pending"}'::jsonb; END IF;
   UPDATE public.ai_request_cache SET hits=hits+1 WHERE key=_key;
   RETURN jsonb_build_object('state','hit','result',entry.result);
 END IF;
 INSERT INTO public.ai_request_cache VALUES(_key,_user,_workspace,_feature,_lease,now()+interval '4 minutes',NULL,0);
 RETURN '{"state":"owner"}'::jsonb;
END $$;
CREATE FUNCTION public.finish_ai_request(_key text,_lease uuid,_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF _result IS NULL THEN DELETE FROM public.ai_request_cache WHERE key=_key AND lease=_lease;
 ELSE UPDATE public.ai_request_cache SET result=_result,expires_at=now()+CASE WHEN feature='sera' THEN interval '2 minutes' ELSE interval '24 hours' END
 WHERE key=_key AND lease=_lease; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_request(text,uuid,uuid,text,uuid),public.finish_ai_request(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(text,uuid,uuid,text,uuid),public.finish_ai_request(text,uuid,jsonb) TO service_role;

-- 0038 already installed the final retry implementation.
REVOKE ALL ON FUNCTION public.reserve_ai_retry(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_retry(uuid,uuid,numeric) TO service_role;
