INSERT INTO public.plan_defaults(plan_key,entitlements)
SELECT 'business_free',(entitlements-'properties') || '{"locations":{"on":true,"limit":1,"unit":"count"},"users":{"on":true,"limit":1,"unit":"count"}}'::jsonb
FROM public.plan_defaults WHERE plan_key='free' ON CONFLICT DO NOTHING;
INSERT INTO public.plan_versions(plan_key,version,name,audience,monthly,yearly,capacity,benefits,entitlements,status)
SELECT 'business_free',1,'Business Free','business',0,0,'{"users":"1 user","places":"1 location"}',ARRAY['One business location','Asset register','Receipt storage','Warranty records'], entitlements,'approved'
FROM public.plan_defaults WHERE plan_key='business_free' ON CONFLICT (plan_key,version) DO NOTHING;
CREATE OR REPLACE FUNCTION public.align_free_audience() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.account_type='business' AND NEW.plan='free' THEN NEW.plan:='business_free';
 ELSIF NEW.account_type<>'business' AND NEW.plan='business_free' THEN NEW.plan:='free'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS align_free_audience ON public.profiles;
CREATE TRIGGER align_free_audience BEFORE INSERT OR UPDATE OF account_type,plan ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.align_free_audience();
UPDATE public.profiles SET plan='business_free' WHERE account_type='business' AND plan='free';
CREATE OR REPLACE FUNCTION public.account_entitlements(_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; key text; result jsonb; published jsonb;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user;
  IF NOT FOUND OR p.suspended THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501'; END IF;
  key := p.plan;
  IF (p.plan_source = 'trial' AND (p.trial_ends_at IS NULL OR p.trial_ends_at <= now()))
    OR (p.plan_source LIKE 'voucher:%' AND p.voucher_ends_at IS NOT NULL AND p.voucher_ends_at <= now()) THEN key := 'free'; END IF;
  IF p.plan_source = 'stripe' AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s JOIN public.runtime_limits r ON r.singleton
    WHERE s.user_id=_user AND s.environment=r.billing_environment
      AND s.status IN ('active','trialing') AND s.current_period_end>now()
  ) THEN key := 'free'; END IF;
  IF key='free' AND p.account_type='business' THEN key:='business_free'; END IF;
  SELECT entitlements INTO result FROM public.plan_defaults WHERE plan_key = key;
  IF result IS NULL THEN RAISE EXCEPTION 'Plan unavailable' USING ERRCODE = '42501'; END IF;
  SELECT entitlements INTO published FROM public.plan_versions
    WHERE plan_key = key AND status = 'approved' AND entitlements IS NOT NULL ORDER BY version DESC LIMIT 1;
  result := result || coalesce(published, '{}'::jsonb);
  -- Only service-role controlled overrides; retain the feature on/off state.
  IF p.limit_overrides ? 'assets' THEN result := jsonb_set(result, '{assets,limit}', p.limit_overrides->'assets'); END IF;
  IF p.limit_overrides ? 'docs' THEN result := jsonb_set(result, '{documents,limit}', p.limit_overrides->'docs'); END IF;
  IF p.limit_overrides ? 'storage' THEN
    result := jsonb_set(result, '{storage,limit}', to_jsonb((p.limit_overrides->>'storage')::numeric / 1048576));
    result := jsonb_set(result, '{storage,unit}', '"MB"');
  END IF;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.start_business_trial() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; expiry timestamptz := now() + interval '14 days';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR p.suspended OR p.account_type NOT IN ('business', 'enterprise') THEN
    RAISE EXCEPTION 'Trial unavailable' USING ERRCODE = '42501';
  END IF;
  IF p.plan NOT IN ('free','business_free') OR p.trial_ends_at IS NOT NULL OR EXISTS
    (SELECT 1 FROM public.trial_history WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Trial unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.trial_history VALUES (auth.uid(), now(), expiry);
  UPDATE public.profiles SET plan = 'business_starter', plan_source = 'trial',
    trial_ends_at = expiry, updated_at = now() WHERE id = auth.uid();
  RETURN expiry;
END $$;
