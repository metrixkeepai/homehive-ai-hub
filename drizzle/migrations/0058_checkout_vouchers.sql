-- Historic discounts consumed capacity on entry. Keep their usage credit and audit row.
ALTER TABLE public.voucher_redemptions ADD COLUMN outcome text NOT NULL DEFAULT 'final',
 ADD COLUMN checkout_session text, ADD COLUMN subscription_id text, ADD COLUMN coupon_id text,
 ADD COLUMN billing_interval text, ADD COLUMN billing_environment text, ADD COLUMN checkout_plan text;
UPDATE public.voucher_redemptions SET outcome='legacy_applied'
 WHERE benefit_type IN ('discount_percent','discount_fixed');
CREATE TABLE public.checkout_voucher_selection (
 user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, plan text NOT NULL, code text NOT NULL,
 PRIMARY KEY(user_id,plan)
);
INSERT INTO public.checkout_voucher_selection
SELECT DISTINCT ON (r.user_id,v.plan) r.user_id,v.plan,r.code FROM public.voucher_redemptions r
JOIN public.vouchers v ON v.code=r.code WHERE r.outcome='legacy_applied'
ORDER BY r.user_id,v.plan,r.created_at DESC;
CREATE TABLE public.checkout_voucher_holds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 code text NOT NULL REFERENCES public.vouchers(code), plan text NOT NULL, environment text NOT NULL, billing_interval text NOT NULL,
 terms jsonb NOT NULL, legacy_id uuid REFERENCES public.voucher_redemptions,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','expired','final')),
 expires_at timestamptz NOT NULL, session_id text UNIQUE, coupon_id text
);
CREATE INDEX checkout_voucher_capacity ON public.checkout_voucher_holds(code,state);
ALTER TABLE public.checkout_voucher_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_voucher_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_voucher_selection,public.checkout_voucher_holds FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.checkout_voucher_selection,public.checkout_voucher_holds TO service_role;

CREATE FUNCTION public.checked_voucher(_user uuid,_code text,_plan text)
RETURNS public.vouchers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.vouchers; p public.profiles; legacy boolean;
BEGIN
 SELECT * INTO STRICT v FROM public.vouchers WHERE code=upper(trim(_code)) FOR UPDATE;
 SELECT * INTO STRICT p FROM public.profiles WHERE id=_user;
 SELECT EXISTS(SELECT FROM public.voucher_redemptions WHERE user_id=_user AND code=v.code AND outcome='legacy_applied') INTO legacy;
 IF p.suspended OR NOT v.active OR v.plan<>_plan OR now()<v.valid_from OR now()>=v.valid_until
 OR (cardinality(v.audiences)>0 AND NOT p.account_type=ANY(v.audiences))
 OR coalesce((SELECT audience FROM public.plan_versions WHERE plan_key=v.plan AND status='approved' ORDER BY version DESC LIMIT 1),
    CASE WHEN v.plan IN ('home','plus','family') THEN 'individual'
         WHEN v.plan IN ('business_starter','business','business_pro','business_scale') THEN 'business' END,
    'unknown')<>p.account_type
 OR (v.assigned_email IS NOT NULL AND NOT EXISTS(SELECT FROM auth.users WHERE id=_user AND lower(email)=lower(v.assigned_email)))
 OR (v.one_per_user AND EXISTS(SELECT FROM public.voucher_redemptions WHERE user_id=_user AND code=v.code AND outcome='final'))
 OR (NOT legacy AND v.uses+(SELECT count(*) FROM public.checkout_voucher_holds WHERE code=v.code AND state='reserved'
 AND legacy_id IS NULL AND user_id<>_user)>=v.max_uses)
 OR (v.benefit_ends_on IS NOT NULL AND v.benefit_ends_on < (now() AT TIME ZONE 'UTC')::date)
 OR (v.duration_months IS NOT NULL AND v.duration_months NOT BETWEEN 1 AND 120)
 OR v.benefit_type NOT IN ('plan','free_period','discount_fixed','discount_percent')
 OR (v.benefit_type='free_period' AND v.duration_months IS NULL AND v.benefit_ends_on IS NULL)
 OR (v.benefit_type IN ('discount_fixed','discount_percent') AND (v.benefit_value IS NULL OR v.benefit_value<=0 OR round(v.benefit_value,2)<>v.benefit_value))
 OR (v.benefit_type='discount_percent' AND v.benefit_value>100)
 OR EXISTS(SELECT FROM public.plan_status WHERE plan_key=v.plan AND NOT active)
 THEN RAISE EXCEPTION 'Voucher unavailable'; END IF;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.checked_voucher(uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.redeem_voucher(_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.vouchers; p public.profiles; ends timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT plan INTO v.plan FROM public.vouchers WHERE code=upper(trim(_code));
 IF NOT FOUND THEN RETURN NULL; END IF;
 v:=public.checked_voucher(auth.uid(),_code,v.plan);
 SELECT * INTO STRICT p FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF v.benefit_type='plan' THEN
   IF p.plan_source='stripe' THEN RAISE EXCEPTION 'Manage the existing subscription first'; END IF;
   ends:=coalesce((v.benefit_ends_on+1)::timestamp AT TIME ZONE 'UTC',now()+make_interval(months=>v.duration_months));
   UPDATE public.profiles SET plan=v.plan,plan_source='voucher:'||v.code,voucher_ends_at=ends,updated_at=now() WHERE id=p.id;
   INSERT INTO public.voucher_redemptions(code,user_id,plan_before,plan_after,benefit_type,benefit_ends_at) VALUES(v.code,p.id,p.plan,v.plan,'plan',ends);
   UPDATE public.vouchers SET uses=uses+1 WHERE code=v.code;
 ELSE
   INSERT INTO public.checkout_voucher_selection VALUES(p.id,v.plan,v.code)
   ON CONFLICT(user_id,plan) DO UPDATE SET code=excluded.code;
 END IF;
 RETURN v.plan;
END $$;

CREATE FUNCTION public.my_checkout_vouchers() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',v.code,'plan',v.plan,'type',v.benefit_type,'value',v.benefit_value,
 'months',v.duration_months,'end',v.benefit_ends_on)), '[]'::jsonb)
 FROM public.checkout_voucher_selection s JOIN public.vouchers v ON v.code=s.code WHERE s.user_id=auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_checkout_vouchers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_checkout_vouchers() TO authenticated;

CREATE FUNCTION public.reserve_checkout_voucher(_user uuid,_plan text,_interval text,_environment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.vouchers; selected text; h public.checkout_voucher_holds; legacy uuid; terms jsonb; cutoff timestamptz;
BEGIN
 IF _interval NOT IN ('monthly','yearly') OR NOT EXISTS(SELECT FROM public.runtime_limits WHERE singleton AND billing_environment=_environment)
 THEN RAISE EXCEPTION 'Billing environment mismatch'; END IF;
 SELECT code INTO selected FROM public.checkout_voucher_selection WHERE user_id=_user AND plan=_plan;
 IF NOT FOUND THEN RETURN NULL; END IF;
 v:=public.checked_voucher(_user,selected,_plan);
 SELECT id INTO legacy FROM public.voucher_redemptions WHERE code=v.code AND user_id=_user AND outcome='legacy_applied' ORDER BY created_at LIMIT 1;
 cutoff:=coalesce((v.benefit_ends_on+1)::timestamp AT TIME ZONE 'UTC',now()+make_interval(months=>v.duration_months));
 terms:=jsonb_build_object('code',v.code,'type',v.benefit_type,'value',v.benefit_value,'months',v.duration_months,'end',cutoff);
 IF EXISTS(SELECT FROM public.checkout_voucher_holds WHERE user_id=_user AND code=v.code AND state='reserved') THEN
   RAISE EXCEPTION 'Previous voucher checkout is pending';
 END IF;
 INSERT INTO public.checkout_voucher_holds(user_id,code,plan,environment,billing_interval,terms,legacy_id,expires_at)
 VALUES(_user,v.code,_plan,_environment,_interval,terms,legacy,least(now()+interval '40 minutes',v.valid_until,cutoff)) RETURNING * INTO h;
 IF h.expires_at<now()+interval '31 minutes' THEN RAISE EXCEPTION 'Voucher validity too short for checkout'; END IF;
 RETURN terms||jsonb_build_object('id',h.id,'expires',floor(extract(epoch FROM h.expires_at)));
END $$;

CREATE FUNCTION public.settle_checkout_voucher(_hold uuid,_environment text,_user uuid,_session text,_subscription text,_coupon text,_state text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.checkout_voucher_holds; before_plan text;
BEGIN
 SELECT * INTO STRICT h FROM public.checkout_voucher_holds WHERE id=_hold AND user_id=_user AND environment=_environment FOR UPDATE;
 IF h.session_id IS NOT NULL AND h.session_id<>_session THEN RAISE EXCEPTION 'Session mismatch'; END IF;
 IF h.state='final' OR (h.state='expired' AND _state='expired') THEN RETURN; END IF;
 IF _state NOT IN ('reserved','expired','final') OR (h.state='expired' AND _state='final') THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 UPDATE public.checkout_voucher_holds SET session_id=coalesce(_session,session_id),coupon_id=coalesce(_coupon,coupon_id),state=_state WHERE id=h.id;
 IF _state<>'final' THEN RETURN; END IF;
 SELECT plan INTO before_plan FROM public.profiles WHERE id=h.user_id;
 IF h.legacy_id IS NULL THEN
  UPDATE public.vouchers SET uses=uses+1 WHERE code=h.code;
  INSERT INTO public.voucher_redemptions(code,user_id,plan_before,plan_after,benefit_type,benefit_value,benefit_ends_at,checkout_plan,
   checkout_session,subscription_id,coupon_id,billing_interval,billing_environment)
  VALUES(h.code,h.user_id,before_plan,h.plan,h.terms->>'type',(h.terms->>'value')::numeric,(h.terms->>'end')::timestamptz,h.plan,
   _session,_subscription,coalesce(_coupon,h.coupon_id),h.billing_interval,h.environment);
 ELSE
  UPDATE public.voucher_redemptions SET outcome='final',checkout_session=_session,subscription_id=_subscription,coupon_id=coalesce(_coupon,h.coupon_id),
   checkout_plan=h.plan,billing_interval=h.billing_interval,billing_environment=h.environment WHERE id=h.legacy_id;
 END IF;
 DELETE FROM public.checkout_voucher_selection WHERE user_id=h.user_id AND plan=h.plan AND code=h.code;
END $$;
REVOKE ALL ON FUNCTION public.reserve_checkout_voucher(uuid,text,text,text),public.settle_checkout_voucher(uuid,text,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_voucher(uuid,text,text,text),public.settle_checkout_voucher(uuid,text,uuid,text,text,text,text) TO service_role;

CREATE FUNCTION public.remove_checkout_voucher(_plan text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DELETE FROM public.checkout_voucher_selection WHERE user_id=auth.uid() AND plan=_plan
$$;
REVOKE ALL ON FUNCTION public.remove_checkout_voucher(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_checkout_voucher(text) TO authenticated;
