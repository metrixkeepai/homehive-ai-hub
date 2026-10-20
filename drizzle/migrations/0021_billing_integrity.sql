CREATE TABLE public.billing_customers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  customer_id text NOT NULL,
  PRIMARY KEY(user_id,environment), UNIQUE(customer_id,environment)
);
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.billing_customers TO service_role;
CREATE TABLE public.billing_events (
  event_id text PRIMARY KEY, environment text NOT NULL,
  created bigint NOT NULL, processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.billing_events TO service_role;
ALTER TABLE public.subscriptions ADD COLUMN last_event_created bigint NOT NULL DEFAULT 0;
ALTER TABLE public.runtime_limits ADD COLUMN billing_environment text CHECK (billing_environment IN ('sandbox','live'));

CREATE FUNCTION public.apply_billing_event(_event text, _created bigint, _environment text, _subscription jsonb, _plan text, _paid boolean) RETURNS boolean
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
  INSERT INTO public.subscriptions(user_id,stripe_subscription_id,stripe_customer_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,environment,last_event_created)
  VALUES(uid,_subscription->>'id',_subscription->>'customer',_subscription->>'product',_subscription->>'price',_subscription->>'status',
    (_subscription->>'period_start')::timestamptz,(_subscription->>'period_end')::timestamptz,coalesce((_subscription->>'cancel_at_period_end')::boolean,false),_environment,_created)
  ON CONFLICT(stripe_subscription_id) DO UPDATE SET status=EXCLUDED.status,product_id=EXCLUDED.product_id,price_id=EXCLUDED.price_id,
    current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,last_event_created=EXCLUDED.last_event_created,updated_at=now();
  IF _paid AND _subscription->>'status' IN ('active','trialing') AND (_subscription->>'period_end')::timestamptz > now() THEN
    UPDATE public.profiles SET plan=_plan,plan_source='stripe',updated_at=now() WHERE id=uid;
  ELSIF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=uid AND environment=_environment AND stripe_subscription_id<>_subscription->>'id' AND status IN ('active','trialing') AND current_period_end>now()) THEN
    UPDATE public.profiles SET plan='free',plan_source='stripe',updated_at=now() WHERE id=uid AND plan_source='stripe';
  END IF;
  INSERT INTO public.billing_events VALUES(_event,_environment,_created,now());
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_billing_event(text,bigint,text,jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_billing_event(text,bigint,text,jsonb,text,boolean) TO service_role;
