INSERT INTO public.feature_flags(key,name,enabled) VALUES
('capture_ai','AI capture',true),('sera_text','Sera text',true),('speech_capture','Recorded speech',true),
('sera_voice','Sera voice',true),('evidence_ai','Evidence extraction',true),
('google_integrations','Google integrations',false),('passport_shares','Passport shares',true)
ON CONFLICT(key) DO NOTHING;
CREATE FUNCTION public.feature_enabled(_user uuid,_key text) RETURNS boolean
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
