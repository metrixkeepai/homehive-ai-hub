CREATE TABLE public.ai_request_cache(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
 workspace_id uuid REFERENCES public.workspaces ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN('sera','capture','speech','video')),
 input_hash text NOT NULL,result jsonb,reservation_id uuid REFERENCES public.operation_reservations ON DELETE SET NULL,
 hit_count integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 UNIQUE(user_id,kind,input_hash));
ALTER TABLE public.ai_request_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_cache FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ai_request_cache TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ai_request_cache TO service_role;
CREATE POLICY cache_owner_read ON public.ai_request_cache FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX ai_cache_expiry ON public.ai_request_cache(expires_at) WHERE result IS NOT NULL;

CREATE TABLE public.ai_budget_days(day date PRIMARY KEY,spent_usd numeric NOT NULL DEFAULT 0 CHECK(spent_usd>=0),reserved_usd numeric NOT NULL DEFAULT 0 CHECK(reserved_usd>=0),held_and_spent_usd numeric NOT NULL DEFAULT 0 CHECK(held_and_spent_usd>=0));
ALTER TABLE public.ai_budget_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_budget_days FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ai_budget_days TO service_role;
INSERT INTO public.ai_budget_days(day,spent_usd,reserved_usd,held_and_spent_usd)
SELECT created_at::date,coalesce(sum(cost_usd),0),0,coalesce(sum(cost_usd),0) FROM public.ai_usage_log WHERE created_at>=date_trunc('month',now()) GROUP BY created_at::date ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_ai_operation(_user uuid,_workspace uuid,_feature text,_estimate numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid; units integer:=1; day_start timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; cap numeric;
BEGIN
 IF _feature NOT IN('capture','video','sera','speech') THEN RAISE EXCEPTION 'Unsupported operation'; END IF;
 IF _estimate IS NULL OR _estimate<=0 OR _estimate>1 THEN RAISE EXCEPTION 'Invalid reservation estimate'; END IF;
 IF _feature IN('sera','speech') THEN
 INSERT INTO public.ai_request_cache(user_id,workspace_id,kind,input_hash,expires_at) VALUES(_user,_workspace,_feature,'probe',now()+interval '1 minute') ON CONFLICT DO NOTHING;
 units:=CASE WHEN EXISTS(SELECT 1 FROM public.ai_request_cache WHERE user_id=_user AND kind=_feature AND input_hash='probe' AND result IS NOT NULL AND expires_at>now()) THEN 0 ELSE 1 END;
 DELETE FROM public.ai_request_cache WHERE user_id=_user AND kind=_feature AND input_hash='probe';
 END IF;
 IF units=0 THEN
 INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd,settled) VALUES(_user,_workspace,_feature,0,_estimate,true) RETURNING id INTO result; RETURN result;
 END IF;
 PERFORM pg_advisory_xact_lock(8102026);
 SELECT daily_ai_budget_usd INTO STRICT cap FROM public.runtime_limits WHERE singleton AND ai_enabled;
 INSERT INTO public.ai_budget_days(day,reserved_usd,held_and_spent_usd) VALUES((now() AT TIME ZONE 'UTC')::date,_estimate,_estimate)
 ON CONFLICT(day) DO UPDATE SET reserved_usd=ai_budget_days.reserved_usd+_estimate,held_and_spent_usd=ai_budget_days.held_and_spent_usd+_estimate
 WHERE ai_budget_days.held_and_spent_usd+_estimate<=cap;
 IF NOT FOUND THEN RAISE EXCEPTION 'Platform AI budget reached'; END IF;
 SELECT public.reserve_operation(_user,_workspace,_feature,units) INTO result;
 UPDATE public.operation_reservations SET reserved_usd=_estimate WHERE id=result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.settle_ai_operation(_id uuid,_user uuid,_feature text,_model text,_input integer,_output integer,_cost numeric,_audio numeric DEFAULT 0) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reserved numeric; spent numeric; day date;
BEGIN
 IF _feature NOT IN('capture','video','sera','speech') THEN RAISE EXCEPTION 'Unsupported operation'; END IF;
 IF _cost IS NULL OR _cost<0 OR _cost>1 OR _input<0 OR _output<0 OR _audio<0 THEN RAISE EXCEPTION 'Invalid settlement'; END IF;
 SELECT reserved_usd INTO STRICT reserved FROM public.operation_reservations WHERE id=_id AND user_id=_user AND feature=_feature AND NOT settled FOR UPDATE;
 IF _cost>reserved THEN RAISE EXCEPTION 'Settlement exceeds reservation'; END IF;
 INSERT INTO public.ai_usage_log(user_id,feature,model,input_tokens,output_tokens,audio_seconds,cost_usd)
 VALUES(_user,_feature,_model,_input,_output,_audio,_cost);
 spent:=GREATEST(_cost-(SELECT coalesce(sum(u.cost_usd),0) FROM public.ai_usage_log u JOIN public.ai_request_cache c ON c.reservation_id=_id AND c.result->>'usage_id'=u.id::text WHERE u.user_id=_user),0);
 SELECT (created_at AT TIME ZONE 'UTC')::date INTO STRICT day FROM public.operation_reservations WHERE id=_id;
 UPDATE public.ai_budget_days SET reserved_usd=GREATEST(reserved_usd-reserved,0),spent_usd=spent_usd+spent,held_and_spent_usd=GREATEST(held_and_spent_usd-reserved+spent,0) WHERE ai_budget_days.day=settle_ai_operation.day;
 UPDATE public.operation_reservations SET settled=true WHERE id=_id;
 UPDATE public.ai_request_cache SET result=NULL,reservation_id=NULL WHERE reservation_id=_id AND result IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.settle_ai_operation(uuid,uuid,text,text,integer,integer,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_operation(uuid,uuid,text,text,integer,integer,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ai_request(_user uuid,_workspace uuid,_feature text,_hash text,_estimate numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cached public.ai_request_cache; reservation uuid;
BEGIN
 IF _feature NOT IN('sera','capture','speech','video') OR _hash IS NULL OR length(_hash)<>64 OR _hash!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request claim'; END IF;
 SELECT * INTO cached FROM public.ai_request_cache WHERE user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace AND kind=_feature AND input_hash=_hash AND result IS NOT NULL AND expires_at>now() FOR UPDATE;
 IF FOUND THEN UPDATE public.ai_request_cache SET hit_count=hit_count+1 WHERE id=cached.id; RETURN jsonb_build_object('state','hit','result',cached.result); END IF;
 reservation:=public.reserve_ai_operation(_user,_workspace,_feature,_estimate);
 INSERT INTO public.ai_request_cache(user_id,workspace_id,kind,input_hash,reservation_id,expires_at) VALUES(_user,_workspace,_feature,_hash,reservation,now()+interval '1 hour')
 ON CONFLICT(user_id,kind,input_hash) DO UPDATE SET workspace_id=excluded.workspace_id,reservation_id=excluded.reservation_id,expires_at=excluded.expires_at WHERE ai_request_cache.result IS NULL;
 SELECT * INTO cached FROM public.ai_request_cache WHERE user_id=_user AND kind=_feature AND input_hash=_hash AND workspace_id IS NOT DISTINCT FROM _workspace;
 IF cached.reservation_id IS DISTINCT FROM reservation THEN DELETE FROM public.operation_reservations WHERE id=reservation AND NOT settled; RETURN jsonb_build_object('state','pending'); END IF;
 RETURN jsonb_build_object('state','claimed','reservation',reservation);
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_request(uuid,uuid,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(uuid,uuid,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_ai_request(_reservation uuid,_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE days integer;
BEGIN
 UPDATE public.ai_request_cache SET result=_result,expires_at=now()+make_interval(days=>CASE kind WHEN 'capture' THEN 30 WHEN 'video' THEN 14 ELSE 7 END)
 WHERE reservation_id=_reservation AND result IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing or completed request'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_ai_request(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ai_request(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_speech_minutes(_user uuid,_workspace uuid,_minutes integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ent jsonb; used numeric; cap numeric; result uuid;
BEGIN
 IF _minutes NOT IN(1,5) THEN RAISE EXCEPTION 'Invalid voice reservation'; END IF;
 ent:=public.account_entitlements(_user);
 IF NOT coalesce((ent->'sera_voice_minutes'->>'on')::boolean,false) THEN RAISE EXCEPTION 'Voice unavailable'; END IF;
 IF _workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user) THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_user::text,1));
 cap:=(ent->'sera_voice_minutes'->>'limit')::numeric;
 SELECT coalesce(sum(audio_seconds),0)/60 INTO used FROM public.ai_usage_log WHERE user_id=_user AND feature='voice' AND created_at>=date_trunc('month',now());
 IF cap IS NOT NULL AND used+_minutes>cap THEN RAISE EXCEPTION 'Monthly voice quota reached'; END IF;
 INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd,settled) VALUES(_user,_workspace,'voice',_minutes,0.000001,true) RETURNING id INTO result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_speech_minutes(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_speech_minutes(uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_sera_review(_draft jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE records jsonb:='[]'; r jsonb; item uuid; link jsonb;
BEGIN
 IF _draft->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Draft not confirmed'; END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(_draft->'records') LOOP
  INSERT INTO public.home_items(user_id,workspace_id,property_id,section,title,subtitle,fields) VALUES(auth.uid(),_draft->>'workspace',nullif(_draft->>'property','')::uuid,r->>'section',left(r->>'title',200),left(coalesce(r->>'subtitle',''),500),coalesce(r->'fields','[]')) RETURNING id INTO item;
  records:=records||jsonb_build_object('id',item,'section',r->>'section');
 END LOOP;
 FOR link IN SELECT * FROM jsonb_array_elements(coalesce(_draft->'links','[]')) LOOP
  INSERT INTO public.record_links(user_id,workspace_id,source_item_id,target_item_id,relationship_type,confidence) VALUES(auth.uid(),_draft->>'workspace',(link->>'source')::uuid,(link->>'target')::uuid,link->>'type',coalesce((link->>'confidence')::numeric,1));
 END LOOP;
 RETURN jsonb_build_object('ok',true,'records',records);
END $$;
REVOKE ALL ON FUNCTION public.confirm_sera_review(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_sera_review(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_sera_review() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT pg_advisory_unlock(hashtextextended(auth.uid()::text,8102026)); $$;
REVOKE ALL ON FUNCTION public.release_sera_review() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.release_sera_review() TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_metered_request(_reservation uuid,_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE day date; reserved numeric;
BEGIN
 SELECT (r.created_at AT TIME ZONE 'UTC')::date,r.reserved_usd INTO day,reserved FROM public.operation_reservations r WHERE r.id=_reservation AND NOT r.settled FOR UPDATE OF r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing reservation'; END IF;
 UPDATE public.ai_request_cache SET result=_result,expires_at=now()+make_interval(days=>CASE kind WHEN 'capture' THEN 30 WHEN 'video' THEN 14 ELSE 7 END) WHERE reservation_id=_reservation AND result IS NULL;
 UPDATE public.ai_budget_days SET reserved_usd=GREATEST(reserved_usd-reserved,0),held_and_spent_usd=GREATEST(held_and_spent_usd-reserved,0) WHERE ai_budget_days.day=finish_metered_request.day;
 UPDATE public.operation_reservations SET settled=true WHERE id=_reservation;
END $$;
REVOKE ALL ON FUNCTION public.finish_metered_request(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_metered_request(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_ai_budget(_since timestamptz DEFAULT now()-interval '30 days')
RETURNS TABLE(usage_rows bigint,unpriced_rows bigint,model text,input_tokens bigint,output_tokens bigint,audio_seconds numeric,costed_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*),count(*) FILTER(WHERE u.cost_usd=0),r.model,sum(u.input_tokens),sum(u.output_tokens),sum(u.audio_seconds),
 sum(CASE WHEN u.model='gpt-4o-mini-realtime-preview' THEN u.audio_seconds/60*r.audio_per_minute_usd ELSE u.input_tokens/1000000.0*r.input_per_million_usd+u.output_tokens/1000000.0*r.output_per_million_usd END)
 FROM public.ai_usage_log u JOIN public.ai_model_rates r ON r.model=u.model WHERE u.created_at>=_since AND (u.created_at>=r.updated_at OR u.cost_usd=0) GROUP BY r.model;
$$;
REVOKE ALL ON FUNCTION public.reconcile_ai_budget(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_budget(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_operation(uuid,uuid,text,numeric) TO service_role;