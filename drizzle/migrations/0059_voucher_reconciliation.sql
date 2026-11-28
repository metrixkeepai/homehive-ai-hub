ALTER TABLE public.checkout_voucher_holds ADD COLUMN target_subscription text;
CREATE UNIQUE INDEX checkout_voucher_coupon ON public.checkout_voucher_holds(environment,coupon_id) WHERE coupon_id IS NOT NULL;
