-- Restore the certified implementation deferred in 0039_sera_connector_review.sql.
CREATE FUNCTION public.sera_retrieve(_workspace uuid,_property uuid,_intent jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH scoped AS NOT MATERIALIZED (
 SELECT h.* FROM public.home_items h WHERE h.user_id=auth.uid()
 AND h.workspace_id IS NOT DISTINCT FROM _workspace AND (_property IS NULL OR h.id=_property OR h.property_id=_property)
), terms AS (SELECT plainto_tsquery('simple',string_agg(w,' ')) q FROM jsonb_array_elements_text(_intent->'words') w),
anchors AS (
 SELECT h.id, ts_rank(public.sera_keywords(h.title,h.section,h.subtitle,h.fields),t.q) rank
 FROM scoped h CROSS JOIN terms t WHERE t.q IS NOT NULL AND
 (public.sera_keywords(h.title,h.section,h.subtitle,h.fields) @@ t.q
 OR EXISTS (SELECT FROM public.evidence_files f WHERE f.item_id=h.id AND to_tsvector('simple',f.name) @@ t.q)
 OR EXISTS (SELECT FROM scoped p WHERE p.id=h.property_id AND to_tsvector('simple',p.title) @@ t.q))
), edges AS (
 SELECT DISTINCT CASE WHEN l.source_item_id=a.id THEN l.target_item_id ELSE l.source_item_id END AS id
 FROM (SELECT id FROM anchors ORDER BY rank DESC,id LIMIT 12) a JOIN public.record_links l ON a.id IN(l.source_item_id,l.target_item_id)
 WHERE l.user_id=auth.uid() AND l.workspace_id IS NOT DISTINCT FROM _workspace AND l.confirmed AND _intent->>'mode'='related'
), matches AS (
 SELECT h.*, a.rank,dt.due FROM scoped h LEFT JOIN anchors a ON a.id=h.id CROSS JOIN terms t
 LEFT JOIN LATERAL (SELECT min(f->>1) due FROM jsonb_array_elements(h.fields) f
 WHERE lower(f->>0) IN ('expiry date','renewal date','end date','due date','next service date','next due date','service due date')
 AND f->>1 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND f->>1 >= current_date::text) dt ON _intent->>'mode'='due'
 WHERE (t.q IS NULL OR a.id IS NOT NULL OR h.id IN (SELECT id FROM edges))
 AND (_intent->>'section' IS NULL OR h.section=_intent->>'section')
 AND (_intent->>'source' IS NULL OR EXISTS (SELECT FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN ('source','captured via') AND (lower(f->>1)=lower(_intent->>'source') OR (_intent->>'source'='email' AND lower(f->>1) IN ('gmail','outlook','import email')))))
 AND (_intent->>'mode'<>'recent' OR h.created_at>=date_trunc('week',now()))
 AND (_intent->>'mode'<>'due' OR dt.due BETWEEN (CASE WHEN _intent->>'window'='next_month' THEN (date_trunc('month',current_date)+interval '1 month')::date ELSE current_date END)::text
 AND (CASE _intent->>'window' WHEN 'next_month' THEN (date_trunc('month',current_date)+interval '2 months - 1 day')::date WHEN 'this_month' THEN (date_trunc('month',current_date)+interval '1 month - 1 day')::date ELSE current_date+90 END)::text)
), limited AS (SELECT id,title,section,subtitle,fields,due FROM matches ORDER BY due,rank DESC NULLS LAST,created_at DESC,id LIMIT 12),
groups AS (SELECT coalesce(p.title,'Unassigned') title,count(*) n FROM matches m LEFT JOIN scoped p ON p.id=m.property_id WHERE _intent->>'mode'='group' GROUP BY m.property_id,p.title ORDER BY n DESC,title LIMIT 12)
SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'rows',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM limited l),'[]'::jsonb),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM groups g),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) TO authenticated;
CREATE TABLE public.connector_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 workspace_id uuid REFERENCES public.workspaces ON DELETE CASCADE, provider text NOT NULL, external_key text NOT NULL,
 title text NOT NULL, source jsonb NOT NULL, proposals jsonb NOT NULL, attachment jsonb, state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','approved','rejected','pending_evidence')),
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,saved jsonb NOT NULL DEFAULT '[]',
 UNIQUE NULLS NOT DISTINCT(user_id,workspace_id,provider,external_key));
ALTER TABLE public.connector_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connector_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.connector_reviews TO authenticated;
GRANT ALL ON public.connector_reviews TO service_role;
CREATE POLICY review_owner ON public.connector_reviews FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_access_workspace(workspace_id));
CREATE TABLE public.connector_scan_state(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,workspace_id uuid REFERENCES public.workspaces ON DELETE CASCADE,
 provider text NOT NULL,account text NOT NULL,watermark bigint NOT NULL DEFAULT 0,upper_bound bigint,page_token text,
 UNIQUE NULLS NOT DISTINCT(user_id,workspace_id,provider,account));
ALTER TABLE public.connector_scan_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connector_scan_state FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.connector_scan_state TO service_role;
CREATE FUNCTION public.confirm_connector_review(_id uuid,_user uuid,_workspace uuid,_property uuid,_room text,_records jsonb,_path text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.connector_reviews; r jsonb; ids jsonb:='[]';rid uuid;doc uuid; other jsonb; dest text; fs jsonb; pname text;
BEGIN
 SELECT * INTO STRICT draft FROM public.connector_reviews WHERE id=_id AND user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace FOR UPDATE;
 IF draft.state IN ('approved','pending_evidence') THEN RETURN draft.saved; END IF;
 IF draft.state<>'pending' OR jsonb_array_length(_records) NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'Review unavailable'; END IF;
 IF _workspace IS NOT NULL AND NOT EXISTS(SELECT FROM public.workspaces WHERE id=_workspace AND owner_id=_user) THEN RAISE EXCEPTION 'Workspace unavailable'; END IF;
 IF _property IS NOT NULL THEN SELECT title INTO STRICT pname FROM public.home_items WHERE id=_property AND user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace AND section IN('my-home','locations'); END IF;
 IF coalesce(_room,'')<>'' AND NOT EXISTS(SELECT FROM public.home_items WHERE user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace AND section='rooms' AND title=_room AND (_property IS NULL OR property_id=_property)) THEN RAISE EXCEPTION 'Room unavailable'; END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(_records) LOOP
 dest:=r->>'section';
 IF dest NOT IN ('rooms','assets','documents','warranties','renewals','insurance','maintenance','vehicles','tasks','services','my-home','locations') THEN RAISE EXCEPTION 'Invalid destination'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_array(f->>'label',f->>'value')),'[]'::jsonb) INTO fs FROM jsonb_array_elements(r->'fields') f;
 fs:=fs||draft.source||jsonb_build_array(jsonb_build_array('Reviewed on',current_date::text));
 IF pname IS NOT NULL THEN fs:=fs||jsonb_build_array(jsonb_build_array('Location',pname)); END IF;
 IF coalesce(_room,'')<>'' THEN fs:=fs||jsonb_build_array(jsonb_build_array('Room',_room)); END IF;
 INSERT INTO public.home_items(user_id,workspace_id,property_id,section,title,subtitle,fields) VALUES(_user,_workspace,_property,dest,r->>'title',r->>'subtitle',fs) RETURNING id INTO rid;
 ids:=ids||jsonb_build_array(jsonb_build_object('id',rid,'section',dest,'title',r->>'title','rel',r->>'relates_to'));
 IF doc IS NULL AND dest='documents' THEN doc:=rid; END IF;
 END LOOP;
 FOR r IN SELECT * FROM jsonb_array_elements(ids) LOOP
 rid:=(r->>'id')::uuid;
 IF doc IS NOT NULL AND rid<>doc THEN
 INSERT INTO public.record_links(user_id,workspace_id,source_item_id,target_item_id,relationship_type,source_document_id,source_capture_type) VALUES(_user,_workspace,rid,doc,'EXTRACTED_FROM',doc,draft.provider); END IF;
 FOR other IN SELECT value FROM jsonb_array_elements(ids) WHERE value->>'title'=r->>'rel' AND value->>'id'<>r->>'id' LOOP
 INSERT INTO public.record_links(user_id,workspace_id,source_item_id,target_item_id,relationship_type,source_document_id,source_capture_type) VALUES(_user,_workspace,rid,(other->>'id')::uuid,'RELATED_TO',doc,draft.provider) ON CONFLICT DO NOTHING;
 END LOOP; END LOOP;
 UPDATE public.connector_reviews SET state=CASE WHEN attachment IS NULL THEN 'approved' ELSE 'pending_evidence' END,reviewed_at=now(),saved=ids WHERE id=_id;RETURN ids;
END $$;
REVOKE ALL ON FUNCTION public.confirm_connector_review(uuid,uuid,uuid,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_connector_review(uuid,uuid,uuid,uuid,text,jsonb,text) TO service_role;

CREATE FUNCTION public.complete_connector_evidence(_id uuid,_user uuid,_workspace uuid,_path text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.connector_reviews; item uuid;
BEGIN
 SELECT * INTO STRICT d FROM public.connector_reviews WHERE id=_id AND user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace FOR UPDATE;
 IF d.state='approved' THEN RETURN; END IF;
 IF d.state<>'pending_evidence' THEN RAISE EXCEPTION 'No approved attachment'; END IF;
 SELECT (e->>'id')::uuid INTO item FROM jsonb_array_elements(d.saved) WITH ORDINALITY x(e,pos) ORDER BY (e->>'section'='documents') DESC,pos LIMIT 1;
 IF _path IS DISTINCT FROM _user::text||'/'||item::text||'/'||(d.attachment->>'hash') THEN RAISE EXCEPTION 'Invalid evidence path'; END IF;
 INSERT INTO public.evidence_files(user_id,item_id,path,name,mime,size) VALUES(_user,item,_path,d.attachment->>'name',d.attachment->>'mime',(d.attachment->>'size')::bigint);
 UPDATE public.connector_reviews SET state='approved' WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_connector_evidence(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_connector_evidence(uuid,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_ai_operation(_user uuid, _workspace uuid, _feature text, _units integer, _estimate numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature_key text; cost numeric; used bigint; cap numeric; settings public.runtime_limits; result uuid;
BEGIN
  IF _estimate IS NULL OR (_estimate < 0 OR (_estimate = 0 AND _feature <> 'sera')) OR _estimate > 5 OR _units IS NULL OR _units < 1 OR _units > 5 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
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
  IF cost > 0 AND _feature NOT IN ('share','report') AND
    coalesce((SELECT held_and_spent_usd FROM public.ai_budget_days WHERE day=(now() AT TIME ZONE 'UTC')::date),0) + cost > settings.daily_ai_budget_usd THEN
    RAISE EXCEPTION 'Platform AI budget reached' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.operation_reservations(user_id,workspace_id,feature,units,reserved_usd) VALUES(_user,_workspace,_feature,_units,cost) RETURNING id INTO result;
  RETURN result;
END $$;

-- Restore the certified implementation deferred in 0040_connector_operations.sql.
CREATE TABLE public.connector_oauth_requests (
 state_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('outlook','onedrive')), verifier text NOT NULL,
 redirect_uri text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
ALTER TABLE public.connector_oauth_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connector_oauth_requests FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,DELETE ON public.connector_oauth_requests TO service_role;
ALTER TABLE public.connector_reviews ADD COLUMN content_hash text, ADD COLUMN extraction_version text;
CREATE UNIQUE INDEX connector_review_content ON public.connector_reviews(user_id,workspace_id,content_hash,extraction_version) NULLS NOT DISTINCT WHERE content_hash IS NOT NULL;
CREATE FUNCTION public.connector_operations() RETURNS TABLE(provider text,connected bigint,reconnect bigint,healthy bigint,failed bigint,last_sync timestamptz,discovered bigint,approved bigint,rejected bigint,ai_calls bigint,estimated_usd numeric) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT p,c.n,c.r,c.h,c.f,c.last_seen,d.n,d.a,d.r,ai.n,ai.cost FROM unnest(ARRAY['google_mail','google_drive','outlook','onedrive']) p
 CROSS JOIN LATERAL (SELECT count(*) n,count(*) FILTER(WHERE reconnect_required) r,count(*) FILTER(WHERE last_sync_at IS NOT NULL AND last_error IS NULL) h,count(*) FILTER(WHERE last_error IS NOT NULL) f,max(last_sync_at) last_seen FROM app_user_connections WHERE connector_id=p) c
 CROSS JOIN LATERAL (SELECT count(*) n,count(*) FILTER(WHERE state='approved') a,count(*) FILTER(WHERE state='rejected') r FROM connector_reviews r WHERE r.provider=p) d
 CROSS JOIN LATERAL (SELECT count(*) n,coalesce(sum(cost_usd),0) cost FROM ai_usage_log WHERE usage_details->>'connector'=p) ai;
$$;
REVOKE ALL ON FUNCTION public.connector_operations() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connector_operations() TO service_role;
CREATE TABLE public.connector_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, provider text NOT NULL, workspace_id uuid REFERENCES public.workspaces ON DELETE CASCADE,
 auto_check boolean NOT NULL DEFAULT false, requested boolean NOT NULL DEFAULT false, last_period date, lease uuid, leased_until timestamptz,
 last_checked timestamptz,last_found integer,last_problem text,
 FOREIGN KEY(user_id,provider) REFERENCES public.app_user_connections(user_id,connector_id) ON DELETE CASCADE,
 UNIQUE NULLS NOT DISTINCT(user_id,workspace_id,provider)
);
ALTER TABLE public.connector_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connector_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.connector_checks TO service_role;
CREATE FUNCTION public.claim_connector_check() RETURNS SETOF public.connector_checks LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH period AS (SELECT date_trunc('month',now())::date+CASE WHEN extract(day FROM now())>=15 THEN 14 ELSE 0 END AS d),
 candidate AS (SELECT k.id FROM connector_checks k JOIN app_user_connections c ON c.user_id=k.user_id AND c.connector_id=k.provider CROSS JOIN period
 WHERE NOT c.reconnect_required AND (k.leased_until IS NULL OR k.leased_until < now()) AND (k.requested OR (k.auto_check AND k.last_period IS DISTINCT FROM period.d)) ORDER BY k.last_checked NULLS FIRST,k.id FOR UPDATE OF k SKIP LOCKED LIMIT 1)
 UPDATE connector_checks k SET lease=gen_random_uuid(),leased_until=now()+interval '25 minutes',requested=false,last_period=period.d FROM candidate,period WHERE k.id=candidate.id RETURNING k.*
$$;
REVOKE ALL ON FUNCTION public.claim_connector_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_connector_check() TO service_role;
ALTER TABLE public.connector_checks ADD COLUMN requested_at timestamptz;
CREATE FUNCTION public.enqueue_connector_check(_user uuid,_workspace uuid,_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO connector_checks(user_id,workspace_id,provider,requested,requested_at) VALUES(_user,_workspace,_provider,true,now())
 ON CONFLICT (user_id,workspace_id,provider) DO UPDATE SET requested=true,requested_at=now()
 WHERE NOT connector_checks.requested AND coalesce(connector_checks.leased_until,'-infinity')<now() AND coalesce(connector_checks.requested_at,'-infinity')<now()-interval '2 minutes';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_connector_check(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_connector_check(uuid,uuid,text) TO service_role;

-- Restore the certified implementation deferred in 0041_connector_evidence_retrieval.sql.
ALTER TABLE public.connector_oauth_requests DROP CONSTRAINT connector_oauth_requests_provider_check;
ALTER TABLE public.connector_oauth_requests ADD CHECK(provider IN ('outlook','onedrive','google_drive','google_mail','google_calendar'));
ALTER TABLE public.evidence_files ADD COLUMN connector_source text;
CREATE OR REPLACE FUNCTION public.complete_connector_evidence(_id uuid,_user uuid,_workspace uuid,_path text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.connector_reviews; item uuid;
BEGIN
 SELECT * INTO STRICT d FROM public.connector_reviews WHERE id=_id AND user_id=_user AND workspace_id IS NOT DISTINCT FROM _workspace FOR UPDATE;
 IF d.state='approved' THEN RETURN; END IF;
 IF d.state<>'pending_evidence' THEN RAISE EXCEPTION 'No approved attachment'; END IF;
 SELECT (e->>'id')::uuid INTO item FROM jsonb_array_elements(d.saved) WITH ORDINALITY x(e,pos) ORDER BY (e->>'section'='documents') DESC,pos LIMIT 1;
 IF _path IS DISTINCT FROM _user::text||'/'||item::text||'/'||(d.attachment->>'hash') THEN RAISE EXCEPTION 'Invalid evidence path'; END IF;
 INSERT INTO public.evidence_files(user_id,item_id,path,name,mime,size,connector_source) VALUES(_user,item,_path,d.attachment->>'name',d.attachment->>'mime',(d.attachment->>'size')::bigint,CASE d.provider WHEN 'google_mail' THEN 'Gmail' WHEN 'google_drive' THEN 'Google Drive' WHEN 'outlook' THEN 'Outlook' WHEN 'onedrive' THEN 'OneDrive' END);
 UPDATE public.connector_reviews SET state='approved' WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_connector_evidence(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_connector_evidence(uuid,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.sera_retrieve(_workspace uuid,_property uuid,_intent jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH scoped AS NOT MATERIALIZED (
 SELECT h.* FROM public.home_items h WHERE h.user_id=auth.uid()
 AND h.workspace_id IS NOT DISTINCT FROM _workspace AND (_property IS NULL OR h.id=_property OR h.property_id=_property)
), terms AS (SELECT to_tsquery('simple',string_agg(CASE w WHEN 'fridge' THEN '(''fridge'' | ''refrigerator'')' WHEN 'tv' THEN '(''tv'' | ''television'')' ELSE quote_literal(w) END,' & ')) q FROM jsonb_array_elements_text(_intent->'words') w WHERE w ~ '^[[:alnum:]]{1,64}$'),
anchors AS (
 SELECT h.id, ts_rank(public.sera_keywords(h.title,h.section,h.subtitle,h.fields),t.q) rank
 FROM scoped h CROSS JOIN terms t WHERE t.q IS NOT NULL AND
 (public.sera_keywords(h.title,h.section,h.subtitle,h.fields) @@ t.q
 OR EXISTS (SELECT FROM public.evidence_files f WHERE f.item_id=h.id AND to_tsvector('simple',f.name) @@ t.q)
 OR EXISTS (SELECT FROM scoped p WHERE p.id=h.property_id AND to_tsvector('simple',p.title) @@ t.q))
), edges AS (
 SELECT DISTINCT CASE WHEN l.source_item_id=a.id THEN l.target_item_id ELSE l.source_item_id END AS id
 FROM (SELECT id FROM anchors ORDER BY rank DESC,id LIMIT 12) a JOIN public.record_links l ON a.id IN(l.source_item_id,l.target_item_id)
 WHERE l.user_id=auth.uid() AND l.workspace_id IS NOT DISTINCT FROM _workspace AND l.confirmed AND _intent->>'mode'='related'
), matches AS (
 SELECT h.*, a.rank,dt.due FROM scoped h LEFT JOIN anchors a ON a.id=h.id CROSS JOIN terms t
 LEFT JOIN LATERAL (SELECT min(f->>1) due FROM jsonb_array_elements(h.fields) f
 WHERE lower(f->>0) IN ('expiry date','renewal date','end date','due date','next service date','next due date','service due date')
 AND f->>1 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND f->>1 >= current_date::text) dt ON _intent->>'mode'='due'
 WHERE (t.q IS NULL OR a.id IS NOT NULL OR h.id IN (SELECT id FROM edges))
 AND (_intent->>'section' IS NULL OR h.section=_intent->>'section')
 AND (_intent->>'source' IS NULL OR EXISTS (SELECT FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN ('source','captured via') AND (lower(f->>1)=lower(_intent->>'source') OR (_intent->>'source'='email' AND lower(f->>1) IN ('gmail','outlook','import email')))))
 AND (_intent->>'mode'<>'missing_warranty' OR (h.section='assets' AND NOT EXISTS(SELECT FROM public.record_links l JOIN scoped w ON w.id=CASE WHEN l.source_item_id=h.id THEN l.target_item_id ELSE l.source_item_id END WHERE h.id IN(l.source_item_id,l.target_item_id) AND l.confirmed AND w.section='warranties') AND NOT EXISTS(SELECT FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) LIKE '%warranty%' AND btrim(f->>1)<>'')))
 AND (_intent->>'mode'<>'recent' OR h.created_at>=date_trunc('week',now()))
 AND (_intent->>'mode'<>'due' OR dt.due BETWEEN (CASE WHEN _intent->>'window'='next_month' THEN (date_trunc('month',current_date)+interval '1 month')::date ELSE current_date END)::text
 AND (CASE _intent->>'window' WHEN 'next_month' THEN (date_trunc('month',current_date)+interval '2 months - 1 day')::date WHEN 'this_month' THEN (date_trunc('month',current_date)+interval '1 month - 1 day')::date ELSE current_date+90 END)::text)
), limited AS (SELECT id,title,section,subtitle,fields,due FROM matches ORDER BY due,rank DESC NULLS LAST,created_at DESC,id LIMIT 12),
groups AS (SELECT coalesce(p.title,'Unassigned') title,count(*) n FROM matches m LEFT JOIN scoped p ON p.id=m.property_id WHERE _intent->>'mode' IN ('group','missing_warranty') GROUP BY m.property_id,p.title ORDER BY n DESC,title LIMIT 12)
 , money AS (SELECT m.id,f->>1 v FROM matches m LEFT JOIN LATERAL(SELECT f FROM jsonb_array_elements(m.fields) f WHERE lower(f->>0) IN('price','purchase price','total','premium','purchase amount') ORDER BY CASE lower(f->>0) WHEN 'total' THEN 0 ELSE 1 END LIMIT 1) f ON true WHERE _intent->>'mode'='sum'), amounts AS(SELECT CASE WHEN v ~ '^(£|GBP ?)' THEN 'GBP' WHEN v ~ '^(€|EUR ?)' THEN 'EUR' WHEN v ~ '^USD ?' THEN 'USD' END currency,CASE WHEN v ~ '^(£|€|GBP ?|EUR ?|USD ?)([0-9]+|[0-9]{1,3}(,[0-9]{3})+)(\.[0-9]{1,2})?$' THEN regexp_replace(v,'[^0-9.]','','g')::numeric END amount FROM money), totals AS (SELECT currency,sum(amount) amount,count(*) n FROM amounts WHERE currency IS NOT NULL AND amount IS NOT NULL GROUP BY currency)
SELECT jsonb_build_object('sums',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM totals x),'[]'::jsonb),'total',(SELECT count(*) FROM matches),'rows',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM limited l),'[]'::jsonb),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM groups g),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) TO authenticated;
ALTER TABLE public.connector_reviews ADD COLUMN reprocessed_at timestamptz;
