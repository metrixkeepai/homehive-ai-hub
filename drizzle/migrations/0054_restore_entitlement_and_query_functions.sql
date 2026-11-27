CREATE OR REPLACE FUNCTION public.account_entitlements(_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
WITH account AS (SELECT p.plan,p.plan_source,p.trial_ends_at,p.voucher_ends_at,p.limit_overrides,p.account_type FROM public.profiles p WHERE p.id=_user AND NOT p.suspended),
version AS (SELECT v.entitlements FROM public.plan_versions v WHERE v.plan_key=(SELECT plan FROM account) AND v.status='approved' ORDER BY v.version DESC LIMIT 1),
fallback AS (SELECT d.entitlements FROM public.plan_defaults d WHERE d.plan_key=(SELECT plan FROM account)),
source AS (SELECT coalesce((SELECT entitlements FROM version),(SELECT entitlements FROM fallback),'{}'::jsonb) base,(SELECT plan_source FROM account) plan_source)
SELECT coalesce((SELECT entitlements FROM version),(SELECT entitlements FROM fallback),'{}'::jsonb) ||
 CASE WHEN (SELECT plan_source FROM account)='trial' AND coalesce((SELECT trial_ends_at FROM account),'-infinity')<now() THEN (SELECT coalesce(d.entitlements,'{}') FROM public.plan_defaults d WHERE d.plan_key='free')
 WHEN (SELECT plan_source FROM account)='stripe' AND NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.user_id=_user AND ((s.status IN('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='canceled' AND s.current_period_end>now()))) THEN (SELECT coalesce(d.entitlements,'{}') FROM public.plan_defaults d WHERE d.plan_key='free')
 WHEN (SELECT plan_source FROM account) LIKE 'voucher:%' AND coalesce((SELECT voucher_ends_at FROM account),'-infinity')<now() THEN (SELECT coalesce(d.entitlements,'{}') FROM public.plan_defaults d WHERE d.plan_key='free') ELSE '{}'::jsonb END ||
 coalesce((SELECT limit_overrides FROM account),'{}'::jsonb) ||
 CASE WHEN (SELECT account_type FROM account) IN('business','enterprise') THEN '{"sera_text_assistant":{"on":true}}' ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION public.account_entitlements(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_entitlements(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.can_share_passport() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.feature_enabled(auth.uid(),'passport_shares') AND coalesce((public.account_entitlements(auth.uid())->'secure_shares'->>'on')::boolean,false)
$$;
REVOKE ALL ON FUNCTION public.can_share_passport() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_share_passport() TO authenticated;
CREATE OR REPLACE FUNCTION public.ai_cost_summary(_since timestamptz DEFAULT now()-interval '30 days')
RETURNS TABLE(calls bigint,users bigint,cost numeric,savings numeric,reserved numeric,speech_minutes numeric,luna bigint,sol bigint,unpriced bigint,measured_input bigint,cache_read bigint,cache_savings numeric,cache_write bigint,hits bigint,operations bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*)::bigint,count(DISTINCT user_id)::bigint,coalesce(sum(cost_usd),0),
 coalesce(sum((usage_details->>'undiscounted_cost_usd')::numeric-cost_usd) FILTER(WHERE jsonb_typeof(usage_details->'undiscounted_cost_usd')='number'),0),
 (SELECT coalesce(sum(reserved_usd),0) FROM operation_reservations WHERE NOT settled),coalesce(sum(audio_seconds),0)/60,
 count(*) FILTER(WHERE model='luna'),count(*) FILTER(WHERE model='sol'),count(*) FILTER(WHERE cost_usd=0),
 coalesce(sum(CASE WHEN usage_details->>'pricing_version' IS NOT NULL THEN input_tokens ELSE 0 END),0),
 coalesce(sum(coalesce((usage_details->>'cached_input_tokens')::bigint,0)),0),
 coalesce(sum(coalesce((usage_details->>'cached_input_tokens')::numeric,0)/1000000*coalesce(input_rate,0)),0),
 coalesce(sum(coalesce((usage_details->>'cache_write_tokens')::bigint,0)),0),
 (SELECT count(*) FROM ai_request_cache WHERE hit_count>0 AND created_at>=_since),(SELECT count(*) FROM operation_reservations WHERE created_at>=_since)
 FROM ai_usage_log u LEFT JOIN LATERAL(SELECT input_per_million_usd input_rate FROM ai_model_rates r WHERE r.model=u.model LIMIT 1) r ON true WHERE u.created_at>=_since;
$$;
REVOKE ALL ON FUNCTION public.ai_cost_summary(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_cost_summary(timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.sera_keywords(_title text,_section text,_subtitle text,_fields jsonb) RETURNS tsvector
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT to_tsvector('simple',coalesce(_title,'')||' '||coalesce(_section,'')||' '||coalesce(_subtitle,'')||' '||coalesce((SELECT string_agg(left(e->>0,100)||' '||left(e->>1,500),' ') FROM jsonb_array_elements(coalesce(_fields,'[]')) e),''))
$$;
CREATE OR REPLACE FUNCTION public.sera_retrieve(_workspace uuid,_property uuid,_intent jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
WITH scoped AS NOT MATERIALIZED (SELECT h.* FROM public.home_items h WHERE h.user_id=auth.uid() AND h.workspace_id IS NOT DISTINCT FROM _workspace AND (_property IS NULL OR h.id=_property OR h.property_id=_property)),
terms AS (SELECT to_tsquery('simple',string_agg(CASE w WHEN 'fridge' THEN '(''fridge'' | ''refrigerator'')' WHEN 'tv' THEN '(''tv'' | ''television'')' ELSE quote_literal(w) END,' & ')) q FROM jsonb_array_elements_text(_intent->'words') w WHERE w ~ '^[[:alnum:]]{1,64}$'),
anchors AS (SELECT h.id,ts_rank(public.sera_keywords(h.title,h.section,h.subtitle,h.fields),t.q) rank FROM scoped h CROSS JOIN terms t WHERE t.q IS NOT NULL AND (public.sera_keywords(h.title,h.section,h.subtitle,h.fields) @@ t.q OR EXISTS(SELECT FROM public.evidence_files f WHERE f.item_id=h.id AND to_tsvector('simple',f.name) @@ t.q) OR EXISTS(SELECT FROM scoped p WHERE p.id=h.property_id AND to_tsvector('simple',p.title) @@ t.q))),
matches AS (SELECT h.*,a.rank,dt.due FROM scoped h LEFT JOIN anchors a ON a.id=h.id CROSS JOIN terms t
 LEFT JOIN LATERAL(SELECT min(f->>1) due FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN('expiry date','renewal date','end date','due date','next service date','next due date','service due date') AND f->>1 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND f->>1>=current_date::text) dt ON _intent->>'mode'='due'
 WHERE (t.q IS NULL OR a.id IS NOT NULL) AND (_intent->>'section' IS NULL OR h.section=_intent->>'section')
 AND (_intent->>'source' IS NULL OR EXISTS(SELECT FROM jsonb_array_elements(h.fields) f WHERE lower(f->>0) IN('source','captured via') AND lower(f->>1)=lower(_intent->>'source')))
 AND (_intent->>'mode' IS DISTINCT FROM 'recent' OR h.created_at>=date_trunc('week',now())))
SELECT jsonb_build_object('records',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'section',section,'title',title,'subtitle',subtitle,'fields',fields,'property_id',property_id,'created_at',created_at,'due',due) ORDER BY created_at DESC) FROM (SELECT * FROM matches ORDER BY CASE WHEN _intent->>'mode'='due' THEN due END NULLS LAST,created_at DESC,id LIMIT 40) m),'[]'),'count',(SELECT count(*) FROM matches))
$$;
REVOKE ALL ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sera_retrieve(uuid,uuid,jsonb) TO authenticated;