CREATE OR REPLACE FUNCTION public.claim_ai_request(_key text,_user uuid,_workspace uuid,_feature text,_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE entry public.ai_request_cache; flag text; benefit text;
BEGIN
 SELECT f,b INTO flag,benefit FROM (VALUES
 ('capture','capture_ai','ai_captures'),('video','capture_ai','room_video_scans'),('sera','sera_text','sera_questions'),
 ('speech','speech_capture','ai_captures')) AS choices(k,f,b) WHERE k=_feature;
 IF NOT EXISTS(SELECT 1 FROM public.runtime_limits WHERE singleton AND ai_enabled)
 THEN RAISE EXCEPTION 'Service temporarily unavailable' USING ERRCODE='42501'; END IF;
 IF flag IS NULL OR NOT public.feature_enabled(_user,flag)
 THEN RAISE EXCEPTION 'Feature temporarily unavailable' USING ERRCODE='42501'; END IF;
 IF NOT coalesce((public.account_entitlements(_user)->benefit->>'on')::boolean,false)
 THEN RAISE EXCEPTION 'Plan feature unavailable' USING ERRCODE='42501'; END IF;
 IF _workspace IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=_workspace AND owner_id=_user)
 THEN RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE='42501'; END IF;
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

CREATE FUNCTION public.effective_plan_catalogue()
RETURNS TABLE(plan_key text,name text,audience text,monthly numeric,yearly numeric,capacity jsonb,benefits text[],entitlements jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT DISTINCT ON (v.plan_key) v.plan_key,v.name,v.audience,v.monthly,v.yearly,v.capacity,v.benefits,
    coalesce(d.entitlements,'{}'::jsonb) || coalesce(v.entitlements,'{}'::jsonb)
  FROM public.plan_versions v LEFT JOIN public.plan_defaults d ON d.plan_key=v.plan_key
  WHERE v.status='approved' ORDER BY v.plan_key,v.version DESC
$$;
REVOKE ALL ON FUNCTION public.effective_plan_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan_catalogue() TO anon,authenticated,service_role;
