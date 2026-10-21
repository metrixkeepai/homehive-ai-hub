CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id uuid NOT NULL,
  environment text NOT NULL,
  customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, environment)
);
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.billing_events (
  event_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.operation_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  feature text NOT NULL,
  units integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.operation_usage TO service_role;
ALTER TABLE public.operation_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS operation_usage_user_idx ON public.operation_usage (user_id, feature, created_at);

ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS audio_seconds numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.passport_shares ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE public.passport_shares ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE OR REPLACE FUNCTION public.feature_enabled(_user uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT enabled FROM public.feature_flags WHERE key = _key), true)
$$;
REVOKE EXECUTE ON FUNCTION public.feature_enabled(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feature_enabled(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_operation(_user uuid, _workspace uuid, _feature text, _units integer DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _used integer;
BEGIN
  IF _units < 1 OR _units > 1000 THEN RETURN NULL; END IF;
  IF NOT public.feature_enabled(_user, _feature) THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_user::text || _feature));
  SELECT coalesce(sum(units), 0) INTO _used FROM public.operation_usage
    WHERE user_id = _user AND feature = _feature AND created_at > now() - interval '1 day';
  IF _used + _units > 500 THEN RETURN NULL; END IF;
  INSERT INTO public.operation_usage (user_id, workspace_id, feature, units)
    VALUES (_user, _workspace, _feature, _units) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.reserve_operation(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operation(uuid, uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_billing_event(_event text, _created bigint, _environment text, _plan text, _paid boolean, _subscription jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid; _status text := _subscription->>'status';
BEGIN
  INSERT INTO public.billing_events (event_id) VALUES (_event) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN true; END IF;
  SELECT user_id INTO _user FROM public.billing_customers
    WHERE customer_id = _subscription->>'customer' AND environment = _environment;
  IF _user IS NULL THEN RAISE EXCEPTION 'Unknown customer'; END IF;
  INSERT INTO public.subscriptions (user_id, environment, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, updated_at)
  VALUES (_user, _environment, _subscription->>'id', _subscription->>'customer', _subscription->>'product', _subscription->>'price', _status,
    (_subscription->>'period_start')::timestamptz, (_subscription->>'period_end')::timestamptz, (_subscription->>'cancel_at_period_end')::boolean, now())
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET product_id = excluded.product_id, price_id = excluded.price_id, status = excluded.status,
    current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();
  IF _status IN ('active', 'trialing') AND _paid THEN
    UPDATE public.profiles SET plan = _plan, plan_source = 'stripe', updated_at = now() WHERE id = _user;
  ELSIF _status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    UPDATE public.profiles SET plan = 'free', plan_source = 'stripe', updated_at = now() WHERE id = _user AND plan_source = 'stripe';
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_billing_event(text, bigint, text, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_billing_event(text, bigint, text, text, boolean, jsonb) TO service_role;