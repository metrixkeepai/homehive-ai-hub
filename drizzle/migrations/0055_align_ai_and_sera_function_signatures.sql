ALTER TABLE public.operation_reservations ADD COLUMN settled_usd numeric CHECK(settled_usd>=0);
ALTER TABLE public.operation_reservations DROP CONSTRAINT operation_reservations_reserved_usd_check;
ALTER TABLE public.operation_reservations ADD CONSTRAINT operation_reservations_reserved_usd_check CHECK(reserved_usd>0 AND reserved_usd<=5);
ALTER TABLE public.ai_usage_log ADD COLUMN reservation_id uuid REFERENCES public.operation_reservations(id) ON DELETE SET NULL;
CREATE INDEX ai_usage_reservation ON public.ai_usage_log(reservation_id) WHERE reservation_id IS NOT NULL;
ALTER TABLE public.ai_request_cache ADD COLUMN key text, ADD COLUMN feature text, ADD COLUMN lease uuid, ADD COLUMN hits bigint NOT NULL DEFAULT 0,
 ADD COLUMN source_reservation uuid REFERENCES public.operation_reservations ON DELETE SET NULL;
CREATE UNIQUE INDEX ai_request_cache_key ON public.ai_request_cache(key) WHERE key IS NOT NULL;
CREATE INDEX ai_request_cache_expiry ON public.ai_request_cache(expires_at);
ALTER TABLE public.ai_model_rates ADD COLUMN processing_mode text NOT NULL DEFAULT 'default', ADD COLUMN provider text NOT NULL DEFAULT 'openai';
CREATE TABLE public.ai_reuse_days(day date NOT NULL,user_id uuid NOT NULL,feature text NOT NULL,hits bigint NOT NULL,savings_usd numeric NOT NULL,unpriced_hits bigint NOT NULL,PRIMARY KEY(day,user_id,feature));
ALTER TABLE public.ai_reuse_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_reuse_days FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ai_reuse_days TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_ai_operation(_user uuid,_workspace uuid,_feature text,_units integer,_estimate numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
 IF _estimate IS NULL OR _estimate<=0 OR _estimate>5 OR _units IS NULL OR _units<1 OR _units>5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 PERFORM pg_advisory_xact_lock(8102026); PERFORM pg_advisory_xact_lock(hashtextextended(_user::text,1)); ent:=public.account_entitlements(_user);
 IF NOT public.feature_enabled(_user,CASE _feature WHEN 'capture' THEN 'capture_ai' WHEN 'video' THEN 'capture_ai' WHEN 'sera' THEN 'sera_text' WHEN 'speech' THEN 'speech_capture' WHEN 'voice' THEN 'sera_voice' WHEN 'share' THEN 'passport_shares' ELSE 'unavailable' END) THEN RAISE EXCEPTION 'Feature temporarily unavailable' USING ERRCODE='42501'; END IF;
 IF _workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user) THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE='42501'; END IF;
 feature_key:=CASE _feature WHEN 'capture' THEN 'ai_captures' WHEN 'video' THEN 'room_video_scans' WHEN 'sera' THEN 'sera_questions' WHEN 'speech' THEN 'ai_captures' WHEN 'voice' THEN 'sera_voice_minutes' WHEN 'share' THEN 'secure_shares' WHEN 'report' THEN 'basic_reports' ELSE NULL END;
 IF feature_key IS NULL OR NOT coalesce((ent->feature_key->>'on')::boolean,false) THEN RAISE EXCEPTION 'Plan feature unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO settings FROM public.runtime_limits WHERE singleton;
 IF NOT FOUND OR (NOT settings.ai_enabled AND _feature NOT IN('share','report')) THEN RAISE EXCEPTION 'Service temporarily unavailable' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO used FROM public.operation_reservations WHERE user_id=_user AND created_at>now()-interval '1 minute';
 IF used>=settings.requests_per_minute THEN RAISE EXCEPTION 'Rate limit reached' USING ERRCODE='42501'; END IF;
 cap:=(ent->feature_key->>'limit')::numeric;
 SELECT coalesce(sum(units),0) INTO used FROM public.operation_reservations WHERE user_id=_user AND (feature=_feature OR(feature_key='ai_captures' AND feature IN('capture','speech'))) AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF cap IS NOT NULL AND used+_units>cap THEN RAISE EXCEPTION 'Monthly quota reached' USING ERRCODE='42501'; END IF;
 cost:=_estimate;
 IF _feature NOT IN('share','report') AND coalesce((SELECT held_and_spent_usd FROM public.ai_budget_days WHERE day=(now() AT TIME ZONE 'UTC')::date),0)+cost>settings.daily_ai_budget_usd THEN RAISE EXCEPTION 'Platform AI budget reached' USING ERRCODE='42501'; END IF;
 INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,integer,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,integer,numeric) TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_operation(_user uuid,_workspace uuid,_feature text,_units integer DEFAULT 1) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.reserve_ai_operation(_user,_workspace,_feature,_units,CASE _feature WHEN 'voice' THEN 4.50 WHEN 'sera' THEN 0.002 WHEN 'speech' THEN 0.015 WHEN 'video' THEN 0.02 WHEN 'capture' THEN 0.01 ELSE 0.000001 END) $$;
CREATE FUNCTION public.claim_ai_request(_key text,_user uuid,_workspace uuid,_feature text,_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE entry public.ai_request_cache; flag text; benefit text;
BEGIN
 SELECT f,b INTO flag,benefit FROM (VALUES('capture','capture_ai','ai_captures'),('video','capture_ai','room_video_scans'),('sera','sera_text','sera_questions'),('speech','speech_capture','ai_captures')) AS choices(k,f,b) WHERE k=_feature;
 IF flag IS NULL OR NOT public.feature_enabled(_user,flag) OR NOT coalesce((public.account_entitlements(_user)->benefit->>'on')::boolean,false) OR NOT EXISTS(SELECT 1 FROM public.runtime_limits WHERE singleton AND ai_enabled) OR (_workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user)) THEN RAISE EXCEPTION 'AI unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_key,9));
 DELETE FROM public.ai_request_cache WHERE key IN(SELECT key FROM public.ai_request_cache WHERE expires_at<=now() ORDER BY expires_at LIMIT 20 FOR UPDATE SKIP LOCKED);
 DELETE FROM public.ai_request_cache WHERE key=_key AND expires_at<=now();
 SELECT * INTO entry FROM public.ai_request_cache WHERE key=_key;
 IF FOUND THEN
  IF entry.user_id<>_user OR entry.workspace_id IS DISTINCT FROM _workspace OR entry.feature<>_feature THEN RAISE EXCEPTION 'Cache scope mismatch'; END IF;
  IF entry.result IS NULL THEN RETURN '{"state":"pending"}'::jsonb; END IF;
  UPDATE public.ai_request_cache SET hits=hits+1 WHERE key=_key; RETURN jsonb_build_object('state','hit','result',entry.result);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_user::text,7));
 IF (SELECT count(*) FROM public.ai_request_cache WHERE user_id=_user AND result IS NULL AND expires_at>now())>=3 OR (_workspace IS NOT NULL AND (SELECT count(*) FROM public.ai_request_cache WHERE workspace_id=_workspace AND result IS NULL AND expires_at>now())>=8) THEN RAISE EXCEPTION 'AI concurrency limit reached'; END IF;
 INSERT INTO public.ai_request_cache(key,user_id,workspace_id,feature,lease,expires_at,result,hits,kind,input_hash) VALUES(_key,_user,_workspace,_feature,_lease,now()+interval '4 minutes',NULL,0,_feature,_key);
 RETURN '{"state":"owner"}'::jsonb;
END $$;
CREATE FUNCTION public.finish_ai_request(_key text,_lease uuid,_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF _result IS NULL THEN DELETE FROM public.ai_request_cache WHERE key=_key AND lease=_lease;
 ELSE UPDATE public.ai_request_cache SET result=_result,expires_at=now()+CASE WHEN feature='sera' THEN interval '2 minutes' ELSE interval '24 hours' END WHERE key=_key AND lease=_lease; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_request(text,uuid,uuid,text,uuid),public.finish_ai_request(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(text,uuid,uuid,text,uuid),public.finish_ai_request(text,uuid,jsonb) TO service_role;
CREATE FUNCTION public.settle_ai_operation(_id uuid,_user uuid,_calls integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE billed numeric; n integer;
BEGIN PERFORM pg_advisory_xact_lock(8102026); SELECT count(*),sum(cost_usd) INTO n,billed FROM public.ai_usage_log WHERE reservation_id=_id AND user_id=_user;
 IF n>0 AND n=_calls THEN UPDATE public.operation_reservations SET settled_usd=billed WHERE id=_id AND user_id=_user AND settled_usd IS NULL; END IF;
END $$;
REVOKE ALL ON FUNCTION public.settle_ai_operation(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_operation(uuid,uuid,integer) TO service_role;
CREATE FUNCTION public.finish_metered_request(_key text,_lease uuid,_result jsonb,_reservation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN UPDATE public.ai_request_cache c SET source_reservation=r.id FROM public.operation_reservations r WHERE c.key=_key AND c.lease=_lease AND r.id=_reservation AND r.user_id=c.user_id AND r.workspace_id IS NOT DISTINCT FROM c.workspace_id;
 PERFORM public.finish_ai_request(_key,_lease,_result);
END $$;
CREATE FUNCTION public.count_ai_reuse() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved numeric;
BEGIN IF NEW.hits=OLD.hits THEN RETURN NEW; END IF; SELECT settled_usd INTO saved FROM public.operation_reservations WHERE id=NEW.source_reservation;
 INSERT INTO public.ai_reuse_days VALUES((now() AT TIME ZONE 'UTC')::date,NEW.user_id,NEW.feature,1,coalesce(saved,0),(saved IS NULL)::int)
 ON CONFLICT(day,user_id,feature) DO UPDATE SET hits=ai_reuse_days.hits+1,savings_usd=ai_reuse_days.savings_usd+excluded.savings_usd,unpriced_hits=ai_reuse_days.unpriced_hits+excluded.unpriced_hits; RETURN NEW;
END $$;
CREATE TRIGGER track_ai_reuse AFTER UPDATE OF hits ON public.ai_request_cache FOR EACH ROW EXECUTE FUNCTION public.count_ai_reuse();
CREATE FUNCTION public.ai_cost_summary(_from timestamptz,_to timestamptz) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH usage AS(SELECT count(*) calls,count(DISTINCT user_id) users,coalesce(sum(cost_usd),0) cost,count(*) FILTER(WHERE model='gpt-6-luna') luna,count(*) FILTER(WHERE model='gpt-6.1-sol') sol,coalesce(sum(input_tokens) FILTER(WHERE usage_details->>'accounting_version'='1'),0) measured_input,coalesce(sum((usage_details->>'cached_tokens')::bigint),0) cache_read,coalesce(sum((usage_details->>'cache_savings_usd')::numeric),0) cache_savings,coalesce(sum(audio_seconds) FILTER(WHERE feature='speak-transcribe'),0)/60 speech_minutes FROM public.ai_usage_log WHERE created_at BETWEEN _from AND _to),
 reservations AS(SELECT count(*) operations,coalesce(sum(reserved_usd),0) reserved FROM public.operation_reservations WHERE created_at BETWEEN _from AND _to AND feature NOT IN('share','report')),
 reuse AS(SELECT coalesce(sum(hits),0) hits,coalesce(sum(savings_usd),0) savings,coalesce(sum(unpriced_hits),0) unpriced FROM public.ai_reuse_days WHERE day BETWEEN(_from AT TIME ZONE 'UTC')::date AND(_to AT TIME ZONE 'UTC')::date)
 SELECT to_jsonb(usage)||to_jsonb(reservations)||to_jsonb(reuse) FROM usage,reservations,reuse
$$;
REVOKE ALL ON FUNCTION public.finish_metered_request(text,uuid,jsonb,uuid),public.ai_cost_summary(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_metered_request(text,uuid,jsonb,uuid),public.ai_cost_summary(timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.sera_retrieve(_workspace uuid,_property uuid,_intent jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH scoped AS NOT MATERIALIZED(SELECT h.* FROM public.home_items h WHERE h.user_id=auth.uid() AND h.workspace_id IS NOT DISTINCT FROM _workspace AND(_property IS NULL OR h.id=_property OR h.property_id=_property)),
terms AS(SELECT plainto_tsquery('simple',string_agg(w,' ')) q FROM jsonb_array_elements_text(_intent->'words') w),
anchors AS(SELECT h.id,ts_rank(public.sera_keywords(h.title,h.section,h.subtitle,h.fields),t.q) rank FROM scoped h CROSS JOIN terms t WHERE t.q IS NOT NULL AND(public.sera_keywords(h.title,h.section,h.subtitle,h.fields) @@ t.q OR EXISTS(SELECT FROM public.evidence_files f WHERE f.item_id=h.id AND to_tsvector('simple',f.name) @@ t.q) OR EXISTS(SELECT FROM scoped p WHERE p.id=h.property_id AND to_tsvector('simple',p.title) @@ t.q))),
edges AS(SELECT DISTINCT CASE WHEN l.source_item_id=a.id THEN l.target_item_id ELSE l.source_item_id END AS id FROM(SELECT id FROM anchors ORDER BY rank DESC,id LIMIT 12) a JOIN public.record_links l ON a.id IN(l.source_item_id,l.target_item_id) WHERE l.user_id=auth.uid() AND l.workspace_id IS NOT DISTINCT FROM _workspace AND l.confirmed AND _intent->>'mode'='related'),
matches AS(SELECT h.*,a.rank,dt.due FROM scoped h LEFT JOIN anchors a ON a.id=h.id CROSS JOIN terms t LEFT JOIN LATERAL(SELECT min(f->>1) due FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN('expiry date','renewal date','end date','due date','next service date','next due date','service due date') AND f->>1 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND f->>1>=current_date::text) dt ON _intent->>'mode'='due'
 WHERE(t.q IS NULL OR a.id IS NOT NULL OR h.id IN(SELECT id FROM edges)) AND(_intent->>'section' IS NULL OR h.section=_intent->>'section') AND(_intent->>'source' IS NULL OR EXISTS(SELECT FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN('source','captured via') AND(lower(f->>1)=lower(_intent->>'source') OR(_intent->>'source'='email' AND lower(f->>1) IN('gmail','outlook','import email'))))) AND(_intent->>'mode'<>'recent' OR h.created_at>=date_trunc('week',now()))
 AND(_intent->>'mode'<>'due' OR dt.due BETWEEN(CASE WHEN _intent->>'window'='next_month' THEN(date_trunc('month',current_date)+interval '1 month')::date ELSE current_date END)::text AND(CASE _intent->>'window' WHEN 'next_month' THEN(date_trunc('month',current_date)+interval '2 months - 1 day')::date WHEN 'this_month' THEN(date_trunc('month',current_date)+interval '1 month - 1 day')::date ELSE current_date+90 END)::text)),
limited AS(SELECT id,title,section,subtitle,fields,due FROM matches ORDER BY due,rank DESC NULLS LAST,created_at DESC,id LIMIT 12),
groups AS(SELECT coalesce(p.title,'Unassigned') title,count(*) n FROM matches m LEFT JOIN scoped p ON p.id=m.property_id WHERE _intent->>'mode'='group' GROUP BY m.property_id,p.title ORDER BY n DESC,title LIMIT 12)
SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'rows',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM limited l),'[]'::jsonb),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM groups g),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) TO authenticated;