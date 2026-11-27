ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS usage_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_model_rates ADD COLUMN cached_input_per_million_usd numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ai_model_rates ADD COLUMN write_per_million_usd numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ai_model_rates ADD COLUMN audio_per_minute_usd numeric NOT NULL DEFAULT 0;
INSERT INTO public.ai_model_rates(model,input_per_million_usd,cached_input_per_million_usd,write_per_million_usd,output_per_million_usd,audio_per_minute_usd) VALUES
('gpt-4o-mini-transcribe',0,0,0,0,0.003),('gpt-4o-mini-realtime-preview',0,0,0,0,0.012) ON CONFLICT(model) DO NOTHING;
CREATE TABLE public.runtime_limits(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),daily_ai_budget_usd numeric NOT NULL DEFAULT 25 CHECK(daily_ai_budget_usd>=0),
 requests_per_minute integer NOT NULL DEFAULT 30 CHECK(requests_per_minute BETWEEN 1 AND 1000),ai_enabled boolean NOT NULL DEFAULT true,
 billing_environment text NOT NULL DEFAULT 'sandbox' CHECK(billing_environment IN ('sandbox','live')),updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.runtime_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runtime_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.runtime_limits TO authenticated;
GRANT ALL ON public.runtime_limits TO service_role;
INSERT INTO public.runtime_limits(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE public.operation_reservations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,workspace_id uuid,feature text NOT NULL,units integer NOT NULL DEFAULT 1 CHECK(units BETWEEN 1 AND 5),
 reserved_usd numeric NOT NULL CHECK(reserved_usd>0 AND reserved_usd<=1),settled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.operation_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operation_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.operation_reservations TO service_role;
CREATE INDEX reservation_user_period ON public.operation_reservations(user_id,feature,created_at DESC);
CREATE INDEX reservation_unsettled ON public.operation_reservations(id) WHERE NOT settled;
CREATE OR REPLACE FUNCTION public.reserve_operation(_user uuid, _workspace uuid, _feature text, _units integer DEFAULT 1) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
 IF _units<1 OR _units>5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 PERFORM pg_advisory_xact_lock(8102026); PERFORM pg_advisory_xact_lock(hashtextextended(_user::text,1));
 ent:=public.account_entitlements(_user);
 IF NOT public.feature_enabled(_user,CASE _feature WHEN 'capture' THEN 'capture_ai' WHEN 'video' THEN 'capture_ai' WHEN 'sera' THEN 'sera_text' WHEN 'speech' THEN 'speech_capture' WHEN 'voice' THEN 'sera_voice' WHEN 'share' THEN 'passport_shares' ELSE 'unavailable' END) THEN RAISE EXCEPTION 'Feature temporarily unavailable'; END IF;
 IF _workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user) THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 feature_key:=CASE _feature WHEN 'capture' THEN 'ai_captures' WHEN 'video' THEN 'room_video_scans' WHEN 'sera' THEN 'sera_questions' WHEN 'speech' THEN 'ai_captures' WHEN 'voice' THEN 'sera_voice_minutes' WHEN 'share' THEN 'secure_shares' WHEN 'report' THEN 'basic_reports' ELSE NULL END;
 IF feature_key IS NULL OR NOT coalesce((ent->feature_key->>'on')::boolean,false) THEN RAISE EXCEPTION 'Plan feature unavailable'; END IF;
 SELECT * INTO settings FROM public.runtime_limits WHERE singleton;
 IF NOT FOUND OR (NOT settings.ai_enabled AND _feature NOT IN('share','report')) THEN RAISE EXCEPTION 'Service temporarily unavailable'; END IF;
 SELECT count(*) INTO used FROM public.operation_reservations WHERE user_id=_user AND created_at>now()-interval '1 minute';
 IF used>=settings.requests_per_minute THEN RAISE EXCEPTION 'Rate limit reached'; END IF;
 cap:=(ent->feature_key->>'limit')::numeric;
 SELECT coalesce(sum(units),0) INTO used FROM public.operation_reservations WHERE user_id=_user AND (feature=_feature OR (feature_key='ai_captures' AND feature IN('capture','speech'))) AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF cap IS NOT NULL AND used+_units>cap THEN RAISE EXCEPTION 'Monthly quota reached'; END IF;
 cost:=CASE WHEN _feature IN('share','report') THEN 0.000001 ELSE 1.0*_units END;
 IF _feature NOT IN('share','report') AND (SELECT coalesce(sum(reserved_usd),0) FROM public.operation_reservations WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+cost>settings.daily_ai_budget_usd THEN RAISE EXCEPTION 'Platform AI budget reached'; END IF;
 INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_operation(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operation(uuid,uuid,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.reconcile_ai_budget(_since timestamptz DEFAULT now()-interval '30 days')
RETURNS TABLE(usage_rows bigint,unpriced_rows bigint,model text,input_tokens bigint,output_tokens bigint,audio_seconds numeric,costed_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*),count(*) FILTER(WHERE u.cost_usd=0),r.model,sum(u.input_tokens),sum(u.output_tokens),sum(u.audio_seconds),
 sum(CASE WHEN u.model='gpt-4o-mini-realtime-preview' THEN u.audio_seconds/60*r.audio_per_minute_usd ELSE u.input_tokens/1000000.0*r.input_per_million_usd+u.output_tokens/1000000.0*r.output_per_million_usd END)
 FROM public.ai_usage_log u JOIN public.ai_model_rates r ON r.model=u.model WHERE u.created_at>=_since AND (u.created_at>=r.updated_at OR u.cost_usd=0) GROUP BY r.model;
$$;
REVOKE ALL ON FUNCTION public.reconcile_ai_budget(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_budget(timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.price_ai_usage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.ai_model_rates;
BEGIN SELECT * INTO r FROM public.ai_model_rates WHERE model=NEW.model;
 IF FOUND AND NEW.cost_usd=0 THEN NEW.cost_usd:=CASE WHEN NEW.model='gpt-4o-mini-realtime-preview' THEN NEW.audio_seconds/60*r.audio_per_minute_usd ELSE NEW.input_tokens/1000000.0*r.input_per_million_usd+NEW.output_tokens/1000000.0*r.output_per_million_usd END; END IF; RETURN NEW;
END $$;
CREATE TRIGGER price_ai_usage BEFORE INSERT OR UPDATE OF input_tokens,output_tokens,audio_seconds,model ON public.ai_usage_log FOR EACH ROW EXECUTE FUNCTION public.price_ai_usage();
CREATE OR REPLACE FUNCTION public.price_sera_voice_usage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.ai_model_rates;
BEGIN IF NEW.feature='voice' AND NEW.model='sera-voice' AND NEW.cost_usd=0 THEN SELECT * INTO r FROM public.ai_model_rates WHERE model='gpt-4o-mini-realtime-preview'; IF FOUND THEN NEW.cost_usd:=NEW.audio_seconds/60*r.audio_per_minute_usd; END IF; END IF; RETURN NEW;
END $$;
CREATE TRIGGER price_sera_voice BEFORE INSERT OR UPDATE OF audio_seconds,feature,model ON public.ai_usage_log FOR EACH ROW EXECUTE FUNCTION public.price_sera_voice_usage();