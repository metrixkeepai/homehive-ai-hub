ALTER TABLE public.operation_reservations ADD COLUMN settled_usd numeric CHECK(settled_usd>=0);
ALTER TABLE public.ai_usage_log ADD COLUMN reservation_id uuid REFERENCES public.operation_reservations(id) ON DELETE SET NULL;
CREATE INDEX ai_usage_reservation ON public.ai_usage_log(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE TABLE public.ai_budget_days(day date PRIMARY KEY, held_and_spent_usd numeric NOT NULL);
ALTER TABLE public.ai_budget_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_budget_days FROM PUBLIC,anon,authenticated;
INSERT INTO public.ai_budget_days SELECT (created_at AT TIME ZONE 'UTC')::date,sum(reserved_usd)
 FROM public.operation_reservations WHERE feature NOT IN ('share','report') GROUP BY 1;
CREATE FUNCTION public.track_ai_budget() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE delta numeric:=coalesce(NEW.settled_usd,NEW.reserved_usd);
BEGIN
 IF NEW.feature IN ('share','report') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN delta:=delta-coalesce(OLD.settled_usd,OLD.reserved_usd); END IF;
 INSERT INTO public.ai_budget_days(day,held_and_spent_usd) VALUES((NEW.created_at AT TIME ZONE 'UTC')::date,delta)
 ON CONFLICT(day) DO UPDATE SET held_and_spent_usd=ai_budget_days.held_and_spent_usd+excluded.held_and_spent_usd;
 RETURN NEW;
END $$;
CREATE TRIGGER track_ai_budget AFTER INSERT OR UPDATE OF reserved_usd,settled_usd ON public.operation_reservations FOR EACH ROW EXECUTE FUNCTION public.track_ai_budget();
CREATE FUNCTION public.settle_ai_operation(_id uuid,_user uuid,_calls integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE billed numeric; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(8102026);
 SELECT count(*),sum(cost_usd) INTO n,billed FROM public.ai_usage_log WHERE reservation_id=_id AND user_id=_user;
 IF n>0 AND n=_calls THEN
 UPDATE public.operation_reservations SET settled_usd=billed WHERE id=_id AND user_id=_user AND settled_usd IS NULL;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.settle_ai_operation(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_operation(uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_operation(_user uuid, _workspace uuid, _feature text, _units integer, _estimate numeric) RETURNS uuid
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
    coalesce((SELECT held_and_spent_usd FROM public.ai_budget_days WHERE day=(now() AT TIME ZONE 'UTC')::date),0) + cost > settings.daily_ai_budget_usd THEN
    RAISE EXCEPTION 'Platform AI budget reached' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_ai_retry(_id uuid,_user uuid,_estimate numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE day_start timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; cap numeric;
BEGIN
 IF _estimate IS NULL OR _estimate<=0 OR _estimate>1 THEN RAISE EXCEPTION 'Invalid retry estimate'; END IF;
 PERFORM pg_advisory_xact_lock(8102026);
 SELECT daily_ai_budget_usd INTO STRICT cap FROM public.runtime_limits WHERE singleton AND ai_enabled;
 IF coalesce((SELECT held_and_spent_usd FROM public.ai_budget_days WHERE day=(now() AT TIME ZONE 'UTC')::date),0) +_estimate>cap THEN RAISE EXCEPTION 'Platform AI budget reached'; END IF;
 UPDATE public.operation_reservations SET reserved_usd=reserved_usd+_estimate WHERE id=_id AND user_id=_user AND feature IN ('capture','video','sera') AND created_at>=day_start;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing reservation'; END IF;
END $$;
ALTER TABLE public.ai_request_cache ADD COLUMN source_reservation uuid REFERENCES public.operation_reservations ON DELETE SET NULL;
CREATE TABLE public.ai_reuse_days(day date NOT NULL,user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,feature text NOT NULL,
 hits bigint NOT NULL,savings_usd numeric NOT NULL,unpriced_hits bigint NOT NULL,PRIMARY KEY(day,user_id,feature));
ALTER TABLE public.ai_reuse_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_reuse_days FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.count_ai_reuse() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved numeric;
BEGIN
 IF NEW.hits=OLD.hits THEN RETURN NEW; END IF;
 SELECT settled_usd INTO saved FROM public.operation_reservations WHERE id=NEW.source_reservation;
 INSERT INTO public.ai_reuse_days VALUES((now() AT TIME ZONE 'UTC')::date,NEW.user_id,NEW.feature,1,coalesce(saved,0),(saved IS NULL)::int)
 ON CONFLICT(day,user_id,feature) DO UPDATE SET hits=ai_reuse_days.hits+1,savings_usd=ai_reuse_days.savings_usd+excluded.savings_usd,unpriced_hits=ai_reuse_days.unpriced_hits+excluded.unpriced_hits;
 RETURN NEW;
END $$;
CREATE TRIGGER track_ai_reuse AFTER UPDATE OF hits ON public.ai_request_cache FOR EACH ROW EXECUTE FUNCTION public.count_ai_reuse();
CREATE FUNCTION public.finish_metered_request(_key text,_lease uuid,_result jsonb,_reservation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.ai_request_cache c SET source_reservation=r.id FROM public.operation_reservations r
 WHERE c.key=_key AND c.lease=_lease AND r.id=_reservation AND r.user_id=c.user_id AND r.workspace_id IS NOT DISTINCT FROM c.workspace_id;
 PERFORM public.finish_ai_request(_key,_lease,_result);
END $$;
CREATE FUNCTION public.ai_cost_summary(_from timestamptz,_to timestamptz) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH usage AS (
 SELECT count(*) calls,count(DISTINCT user_id) users,coalesce(sum(cost_usd),0) cost,
 count(*) FILTER(WHERE model='gpt-6-luna') luna,count(*) FILTER(WHERE model='gpt-6.1-sol') sol,
 coalesce(sum(input_tokens) FILTER(WHERE usage_details->>'accounting_version'='1'),0) measured_input,
 coalesce(sum((usage_details->>'cached_tokens')::bigint),0) cache_read,
 coalesce(sum((usage_details->>'cache_savings_usd')::numeric),0) cache_savings,
 coalesce(sum(audio_seconds) FILTER(WHERE feature='speak-transcribe'),0)/60 speech_minutes
 FROM public.ai_usage_log WHERE created_at BETWEEN _from AND _to),
 reservations AS (SELECT count(*) operations,coalesce(sum(reserved_usd),0) reserved FROM public.operation_reservations
 WHERE created_at BETWEEN _from AND _to AND feature NOT IN ('share','report')),
 reuse AS (SELECT coalesce(sum(hits),0) hits,coalesce(sum(savings_usd),0) savings,coalesce(sum(unpriced_hits),0) unpriced
 FROM public.ai_reuse_days WHERE day BETWEEN (_from AT TIME ZONE 'UTC')::date AND (_to AT TIME ZONE 'UTC')::date)
 SELECT to_jsonb(usage)||to_jsonb(reservations)||to_jsonb(reuse) FROM usage,reservations,reuse
$$;
REVOKE ALL ON FUNCTION public.finish_metered_request(text,uuid,jsonb,uuid),public.ai_cost_summary(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_metered_request(text,uuid,jsonb,uuid),public.ai_cost_summary(timestamptz,timestamptz) TO service_role;

CREATE INDEX ai_cache_active_user ON public.ai_request_cache(user_id,expires_at) WHERE result IS NULL;
CREATE INDEX ai_cache_active_workspace ON public.ai_request_cache(workspace_id,expires_at) WHERE result IS NULL;
CREATE OR REPLACE FUNCTION public.claim_ai_request(_key text,_user uuid,_workspace uuid,_feature text,_lease uuid) RETURNS jsonb
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
 PERFORM pg_advisory_xact_lock(hashtextextended(_user::text, 7));
 IF (SELECT count(*) FROM public.ai_request_cache WHERE user_id=_user AND result IS NULL AND expires_at>now())>=3
 OR (_workspace IS NOT NULL AND (SELECT count(*) FROM public.ai_request_cache WHERE workspace_id=_workspace AND result IS NULL AND expires_at>now())>=8)
 THEN RAISE EXCEPTION 'AI concurrency limit reached'; END IF;
 INSERT INTO public.ai_request_cache(key,user_id,workspace_id,feature,lease,expires_at,result,hits) VALUES(_key,_user,_workspace,_feature,_lease,now()+interval '4 minutes',NULL,0);
 RETURN '{"state":"owner"}'::jsonb;
END $$;

-- The invoker's RLS and explicit identity/scope filters both apply before ranking.
CREATE FUNCTION public.sera_keywords(_title text,_section text,_subtitle text,_fields jsonb) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT setweight(to_tsvector('simple',coalesce(_title,'')),'A') ||
        setweight(to_tsvector('simple',coalesce(_section,'')||' '||coalesce(_subtitle,'')),'B') ||
        setweight(to_tsvector('simple',coalesce(_fields::text,'')),'C')
$$;
CREATE INDEX home_items_sera_keywords ON public.home_items USING gin(public.sera_keywords(title,section,subtitle,fields));
CREATE FUNCTION public.sera_search(_workspace uuid,_property uuid,_words text[]) RETURNS TABLE(section text,title text,subtitle text,fields jsonb) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH search AS (SELECT to_tsquery('simple',string_agg(quote_literal(w),' | ')) q FROM (SELECT w FROM unnest(_words) AS words(w) WHERE w ~ '^[[:alnum:]]{2,30}$' LIMIT 10) validated)
 SELECT h.section,h.title,h.subtitle,h.fields FROM public.home_items h CROSS JOIN search
 WHERE h.user_id=auth.uid() AND h.workspace_id IS NOT DISTINCT FROM _workspace
 AND (_property IS NULL OR h.id=_property OR h.property_id=_property)
 AND (q IS NULL OR public.sera_keywords(h.title,h.section,h.subtitle,h.fields) @@ q)
 ORDER BY ts_rank(public.sera_keywords(h.title,h.section,h.subtitle,h.fields),q) DESC NULLS LAST,h.created_at DESC,h.id LIMIT 12
$$;
REVOKE ALL ON FUNCTION public.sera_search(uuid,uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sera_search(uuid,uuid,text[]) TO authenticated;

INSERT INTO public.ai_model_rates(model,input_per_million_usd,output_per_million_usd)
VALUES('gpt-4o-mini-transcribe',1.25,5) ON CONFLICT(model) DO NOTHING;

CREATE TABLE public.ai_benchmark_results (
 execution text NOT NULL, sha text NOT NULL, sample integer NOT NULL, observation jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(execution,sample)
);
ALTER TABLE public.ai_benchmark_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_benchmark_results FROM PUBLIC,anon,authenticated;
GRANT INSERT,SELECT ON public.ai_benchmark_results TO service_role;
