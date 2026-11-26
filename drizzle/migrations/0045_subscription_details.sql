ALTER TABLE public.subscriptions
  ADD COLUMN plan_key text,
  ADD COLUMN billing_interval text CHECK (billing_interval IN ('month','year')),
  ADD COLUMN trial_start timestamptz,
  ADD COLUMN trial_end timestamptz;

-- Recover known catalogue values for earlier subscriptions. Future signed events
-- populate any missing trial dates from the current provider subscription.
UPDATE public.subscriptions s SET plan_key=h.plan_key,billing_interval=h.interval_name
FROM public.billing_price_history h
WHERE h.environment=s.environment AND h.price_id=s.price_id;

CREATE OR REPLACE FUNCTION public.apply_billing_event(_event text, _created bigint, _environment text, _subscription jsonb, _plan text, _paid boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid; previous public.subscriptions; current_env text;
BEGIN
  SELECT billing_environment INTO current_env FROM public.runtime_limits WHERE singleton;
  IF current_env IS NULL OR _environment <> current_env THEN RAISE EXCEPTION 'Billing environment mismatch'; END IF;
  SELECT user_id INTO uid FROM public.billing_customers WHERE customer_id = _subscription->>'customer' AND environment = _environment;
  IF uid IS NULL THEN RAISE EXCEPTION 'Unknown billing customer'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  IF EXISTS(SELECT 1 FROM public.billing_events WHERE event_id=_event) THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.plan_defaults WHERE plan_key=_plan) THEN RAISE EXCEPTION 'Unknown billing plan'; END IF;
  SELECT * INTO previous FROM public.subscriptions WHERE stripe_subscription_id=_subscription->>'id' FOR UPDATE;
  IF FOUND AND (previous.user_id<>uid OR previous.environment<>_environment) THEN RAISE EXCEPTION 'Subscription binding mismatch'; END IF;
  IF FOUND AND previous.last_event_created > _created THEN
    INSERT INTO public.billing_events VALUES(_event,_environment,_created,now()); RETURN false;
  END IF;
  INSERT INTO public.subscriptions(user_id,stripe_subscription_id,stripe_customer_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,environment,last_event_created,plan_key,billing_interval,trial_start,trial_end)
  VALUES(uid,_subscription->>'id',_subscription->>'customer',_subscription->>'product',_subscription->>'price',_subscription->>'status',
    (_subscription->>'period_start')::timestamptz,(_subscription->>'period_end')::timestamptz,coalesce((_subscription->>'cancel_at_period_end')::boolean,false),_environment,_created,
    _plan,_subscription->>'interval',(_subscription->>'trial_start')::timestamptz,(_subscription->>'trial_end')::timestamptz)
  ON CONFLICT(stripe_subscription_id) DO UPDATE SET status=EXCLUDED.status,product_id=EXCLUDED.product_id,price_id=EXCLUDED.price_id,
    current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,last_event_created=EXCLUDED.last_event_created,updated_at=now(),
    plan_key=EXCLUDED.plan_key,billing_interval=COALESCE(EXCLUDED.billing_interval,previous.billing_interval),
    trial_start=CASE WHEN _subscription ? 'trial_start' THEN EXCLUDED.trial_start ELSE previous.trial_start END,
    trial_end=CASE WHEN _subscription ? 'trial_end' THEN EXCLUDED.trial_end ELSE previous.trial_end END;
  IF _paid AND _subscription->>'status' IN ('active','trialing') AND (_subscription->>'period_end')::timestamptz > now() THEN
    UPDATE public.profiles SET plan=_plan,plan_source='stripe',updated_at=now() WHERE id=uid;
  ELSIF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=uid AND environment=_environment AND stripe_subscription_id<>_subscription->>'id' AND status IN ('active','trialing') AND current_period_end>now()) THEN
    UPDATE public.profiles SET plan='free',plan_source='stripe',updated_at=now() WHERE id=uid AND plan_source='stripe';
  END IF;
  INSERT INTO public.billing_events VALUES(_event,_environment,_created,now());
  RETURN true;
END $$;
