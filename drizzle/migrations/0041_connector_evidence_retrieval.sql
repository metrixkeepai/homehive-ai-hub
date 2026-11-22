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
