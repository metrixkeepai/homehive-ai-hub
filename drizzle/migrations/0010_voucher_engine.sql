ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS code_type text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS benefit_type text NOT NULL DEFAULT 'plan',
  ADD COLUMN IF NOT EXISTS benefit_value numeric,
  ADD COLUMN IF NOT EXISTS duration_months integer,
  ADD COLUMN IF NOT EXISTS benefit_ends_on date,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS audiences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_email text,
  ADD COLUMN IF NOT EXISTS one_per_user boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voucher_ends_at timestamptz;

CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  user_id uuid NOT NULL,
  plan_before text,
  plan_after text,
  benefit_type text NOT NULL,
  benefit_value numeric,
  benefit_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.voucher_redemptions TO service_role;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX voucher_redemptions_code_idx ON public.voucher_redemptions(code);
CREATE INDEX voucher_redemptions_user_idx ON public.voucher_redemptions(user_id);

CREATE OR REPLACE FUNCTION public.redeem_voucher(_code text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.vouchers; p public.profiles; e text; ends timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v FROM public.vouchers WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND OR NOT v.active OR v.uses >= v.max_uses THEN RETURN NULL; END IF;
  IF v.valid_from IS NOT NULL AND now() < v.valid_from THEN RETURN NULL; END IF;
  IF v.valid_until IS NOT NULL AND now() > v.valid_until THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF array_length(v.audiences, 1) > 0 AND NOT (p.account_type = ANY (v.audiences)) THEN RETURN NULL; END IF;
  IF v.assigned_email IS NOT NULL THEN
    SELECT email INTO e FROM auth.users WHERE id = auth.uid();
    IF lower(e) <> lower(v.assigned_email) THEN RETURN NULL; END IF;
  END IF;
  IF v.one_per_user AND EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE code = v.code AND user_id = auth.uid()) THEN RETURN NULL; END IF;
  ends := CASE WHEN v.benefit_ends_on IS NOT NULL THEN (v.benefit_ends_on::timestamp + interval '1 day' - interval '1 second') AT TIME ZONE 'UTC'
               WHEN v.duration_months IS NOT NULL THEN now() + make_interval(months => v.duration_months) ELSE NULL END;
  UPDATE public.vouchers SET uses = uses + 1 WHERE code = v.code;
  IF v.benefit_type IN ('plan', 'free_period') THEN
    UPDATE public.profiles SET plan = v.plan, plan_source = 'voucher:' || v.code, voucher_ends_at = ends, updated_at = now() WHERE id = auth.uid();
  END IF;
  INSERT INTO public.voucher_redemptions(code, user_id, plan_before, plan_after, benefit_type, benefit_value, benefit_ends_at)
    VALUES (v.code, auth.uid(), p.plan, CASE WHEN v.benefit_type IN ('plan','free_period') THEN v.plan ELSE p.plan END, v.benefit_type, v.benefit_value, ends);
  RETURN v.plan;
END; $function$;