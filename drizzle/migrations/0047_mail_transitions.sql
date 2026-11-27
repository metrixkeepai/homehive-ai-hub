-- Queue display fields from committed account changes. No existing records are backfilled.
ALTER TABLE matrixkeep_mail.pending ADD COLUMN IF NOT EXISTS display_fields jsonb NOT NULL DEFAULT '{}';
ALTER TABLE matrixkeep_mail.pending DROP CONSTRAINT IF EXISTS pending_kind_check;
ALTER TABLE matrixkeep_mail.pending ADD CONSTRAINT pending_kind_check CHECK
  (kind IN ('welcome','voucher','activated','upgraded','downgraded','cancelled','security'));

CREATE OR REPLACE FUNCTION matrixkeep_mail.profile_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  names constant jsonb := '{"free":"Free","home":"Home","plus":"Home+","family":"Family","business_starter":"Starter","business":"Business","business_pro":"Business Pro","business_scale":"Business Scale"}';
  tiers constant jsonb := '{"free":0,"home":1,"plus":2,"family":3,"business_starter":1,"business":2,"business_pro":3,"business_scale":4}';
  kind text;
  sub public.subscriptions%ROWTYPE;
BEGIN
  IF OLD.suspended IS DISTINCT FROM NEW.suspended THEN
    INSERT INTO matrixkeep_mail.pending(kind,source_id,user_id,display_fields)
    VALUES ('security',gen_random_uuid(),NEW.id,jsonb_build_object(
      'security_event',CASE WHEN NEW.suspended THEN 'Your account was suspended' ELSE 'Your account access was restored' END,
      'event_date',to_char(now() AT TIME ZONE 'UTC','DD Mon YYYY HH24:MI "UTC"')));
  END IF;
  IF NEW.plan_source IS DISTINCT FROM 'stripe' OR NEW.plan = 'free' OR NOT names ? NEW.plan
    OR (OLD.plan IS NOT DISTINCT FROM NEW.plan AND OLD.plan_source IS NOT DISTINCT FROM NEW.plan_source)
  THEN RETURN NEW; END IF;
  SELECT s.* INTO sub FROM public.subscriptions s JOIN public.runtime_limits l
    ON l.singleton AND l.billing_environment=s.environment
    WHERE s.user_id=NEW.id AND s.plan_key=NEW.plan AND s.status IN ('active','trialing')
      AND s.current_period_end>now() ORDER BY s.updated_at DESC,s.id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF OLD.plan_source IS DISTINCT FROM 'stripe' OR OLD.plan='free' THEN kind:='activated';
  ELSIF (tiers->>NEW.plan)::int > (tiers->>OLD.plan)::int THEN kind:='upgraded';
  ELSIF (tiers->>NEW.plan)::int < (tiers->>OLD.plan)::int THEN kind:='downgraded';
  ELSE RETURN NEW; END IF;
  INSERT INTO matrixkeep_mail.pending(kind,source_id,user_id,display_fields)
  VALUES (kind,gen_random_uuid(),NEW.id,jsonb_strip_nulls(jsonb_build_object(
    'plan_name',names->>NEW.plan,'new_plan',names->>NEW.plan,'old_plan',names->>OLD.plan,
    'billing_interval',CASE sub.billing_interval WHEN 'month' THEN 'Monthly' WHEN 'year' THEN 'Yearly' END,
    'renewal_date',to_char(sub.current_period_end AT TIME ZONE 'UTC','DD Mon YYYY'),
    'effective_date',to_char(now() AT TIME ZONE 'UTC','DD Mon YYYY'),'already_effective',kind='downgraded')));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION matrixkeep_mail.subscription_cancellation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  scheduled boolean := NEW.cancel_at_period_end AND NEW.status IN ('active','trialing');
  names constant jsonb := '{"home":"Home","plus":"Home+","family":"Family","business_starter":"Starter","business":"Business","business_pro":"Business Pro","business_scale":"Business Scale"}';
BEGIN
  IF NOT names ? NEW.plan_key OR NOT EXISTS(SELECT FROM public.runtime_limits WHERE singleton AND billing_environment=NEW.environment)
    OR (NOT scheduled AND NEW.status <> 'canceled') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND (OLD.status='canceled' OR OLD.cancel_at_period_end) THEN RETURN NEW; END IF;
  INSERT INTO matrixkeep_mail.pending(kind,source_id,user_id,display_fields)
  VALUES ('cancelled',gen_random_uuid(),NEW.user_id,jsonb_build_object(
    'plan_name',names->>NEW.plan_key,'end_of_period',scheduled,
    'access_end_date',to_char(NEW.current_period_end AT TIME ZONE 'UTC','DD Mon YYYY')));
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION matrixkeep_mail.profile_transition(),matrixkeep_mail.subscription_cancellation() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE TRIGGER matrixkeep_mail_on_profile_transition AFTER UPDATE OF plan,plan_source,suspended ON public.profiles
FOR EACH ROW EXECUTE FUNCTION matrixkeep_mail.profile_transition();
CREATE OR REPLACE TRIGGER matrixkeep_mail_on_subscription_cancel AFTER INSERT OR UPDATE OF status,cancel_at_period_end ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION matrixkeep_mail.subscription_cancellation();

CREATE OR REPLACE VIEW matrixkeep_mail.messages AS
SELECT p.kind, p.source_id, u.email, u.raw_user_meta_data->>'first_name' AS first_name,
       CASE WHEN v.id IS NOT NULL THEN '••••' || right(v.code,least(4,greatest(length(v.code)-1,0))) END AS voucher_code_masked,
       replace(v.benefit_type,'_',' ') AS voucher_benefit,
       to_char(v.benefit_ends_at AT TIME ZONE 'UTC','DD Mon YYYY') AS voucher_expiry, p.display_fields
FROM matrixkeep_mail.pending p JOIN auth.users u ON u.id=p.user_id
LEFT JOIN public.voucher_redemptions v ON p.kind='voucher' AND v.id=p.source_id AND v.user_id=p.user_id
WHERE u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL;
