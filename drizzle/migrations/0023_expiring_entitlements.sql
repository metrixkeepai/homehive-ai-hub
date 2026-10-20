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
