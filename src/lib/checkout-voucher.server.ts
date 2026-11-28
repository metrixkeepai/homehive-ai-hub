import type Stripe from "stripe";
import type { StripeEnv } from "./stripe.server";
import { supabaseAdmin as db } from "../integrations/supabase/client.server";
import { discountMonths, type VoucherOffer } from "./voucher-terms";
export type Hold = VoucherOffer & { id: string; expires: number };

export async function reserve(
  user: string,
  plan: string,
  interval: string,
  environment: StripeEnv,
) {
  const result = await db.rpc("reserve_checkout_voucher", {
    _user: user,
    _plan: plan,
    _interval: interval,
    _environment: environment,
  });
  if (result.error) throw new Error("Voucher unavailable at checkout");
  return result.data as Hold | null;
}
export async function settle(
  id: string,
  environment: StripeEnv,
  user: string,
  session: string | null,
  sub: string | null,
  coupon: string | null,
  state: "reserved" | "expired" | "final",
) {
  const r = await db.rpc("settle_checkout_voucher", {
    _hold: id,
    _environment: environment,
    _user: user,
    _session: session,
    _subscription: sub,
    _coupon: coupon,
    _state: state,
  });
  if (r.error) throw new Error("Voucher reconciliation pending");
}
export async function checkoutBenefit(
  stripe: Stripe,
  h: Hold,
  product: string,
  environment: StripeEnv,
) {
  if (h.type === "free_period") {
    const end = Math.floor(Date.parse(h.end!) / 1000);
    return { trial_end: end };
  }
  const months = h.months ?? (h.end ? discountMonths(new Date(), new Date(h.end)) : null);
  const coupon = await stripe.coupons.create(
    {
      name: h.code,
      ...(months ? { duration: "repeating", duration_in_months: months } : { duration: "forever" }),
      ...(h.type === "discount_fixed"
        ? { amount_off: Math.round(h.value! * 100), currency: "gbp" }
        : { percent_off: h.value! }),
      applies_to: { products: [product] },
      max_redemptions: 1,
      redeem_by: h.expires,
      metadata: { app: "matrixkeep", environment, voucher: h.code, reservation: h.id },
    },
    { idempotencyKey: "matrixkeep-voucher-" + h.id },
  );
  return { coupon: coupon.id };
}
