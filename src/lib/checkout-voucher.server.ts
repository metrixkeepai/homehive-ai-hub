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

// Stripe may accept a request before a network failure reaches the application.
// Release capacity only after checking the provider for that reservation.
export async function reconcileExpired(stripe: Stripe, code: string, environment: StripeEnv) {
  const stale = await db
    .from("checkout_voucher_holds")
    .select("*")
    .eq("code", code)
    .eq("environment", environment)
    .eq("state", "reserved")
    .lt("expires_at", new Date(Date.now() - 60000).toISOString())
    .limit(25);
  if (stale.error) throw new Error("Voucher reconciliation pending");
  for (const h of stale.data) {
    if (h.target_subscription && h.coupon_id) {
      const coupon = await stripe.coupons.retrieve(h.coupon_id);
      if (!coupon.times_redeemed)
        await settle(h.id, environment, h.user_id, h.session_id, null, h.coupon_id, "expired");
      continue;
    }
    let session: Stripe.Checkout.Session | undefined;
    if (h.session_id) session = await stripe.checkout.sessions.retrieve(h.session_id);
    else {
      const customer = await db
        .from("billing_customers")
        .select("customer_id")
        .eq("user_id", h.user_id)
        .eq("environment", environment)
        .single();
      if (customer.error) throw new Error("Voucher reconciliation pending");
      const until = Math.ceil(Date.parse(h.expires_at) / 1000);
      for await (const candidate of stripe.checkout.sessions.list({
        customer: customer.data.customer_id,
        created: { gte: until - 41 * 60, lte: until },
        limit: 100,
      })) {
        if (candidate.metadata?.["hold"] === h.id) {
          session = candidate;
          break;
        }
      }
    }
    if (!session || session.status === "expired")
      await settle(h.id, environment, h.user_id, session?.id ?? null, null, h.coupon_id, "expired");
    else if (
      session.status === "complete" &&
      session.payment_status !== "unpaid" &&
      typeof session.subscription === "string"
    )
      await settle(
        h.id,
        environment,
        h.user_id,
        session.id,
        session.subscription,
        session.metadata?.["voucher_coupon"] ?? null,
        "final",
      );
  }
}

export async function bindUpgrade(hold: Hold, coupon: string, subscription: string) {
  const r = await db
    .from("checkout_voucher_holds")
    .update({ coupon_id: coupon, target_subscription: subscription })
    .eq("id", hold.id)
    .eq("state", "reserved")
    .select("id")
    .single();
  if (r.error) throw new Error("Voucher reconciliation pending");
}

export async function paidPortalVoucher(
  stripe: Stripe,
  invoiceId: string,
  subscription: string,
  environment: StripeEnv,
) {
  const pending = await db
    .from("checkout_voucher_holds")
    .select("*")
    .eq("target_subscription", subscription)
    .eq("environment", environment)
    .eq("state", "reserved");
  if (pending.error) throw new Error("Voucher reconciliation pending");
  if (!pending.data.length) return;
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["discounts"] });
  if (invoice.status !== "paid") return;
  for (const h of pending.data) {
    const applied = invoice.discounts.some((d) => {
      if (typeof d === "string") return false;
      const coupon = d.source.coupon;
      return coupon && (typeof coupon === "string" ? coupon : coupon.id) === h.coupon_id;
    });
    if (applied)
      await settle(h.id, environment, h.user_id, h.session_id, subscription, h.coupon_id, "final");
  }
}
