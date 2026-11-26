import type Stripe from "stripe";
import { createStripeClient, stripeEnvironment, verifyWebhook } from "./stripe.server";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { validatedPrice } from "./stripe-billing.server";

export async function handleStripeWebhook(request: Request) {
  if (process.env["STRIPE_ENVIRONMENT"] === "disabled")
    return new Response("Billing disabled", { status: 503 });
  let event: Stripe.Event;
  const environment = stripeEnvironment();
  const requested = new URL(request.url).searchParams.get("env");
  if (requested && requested !== environment)
    return new Response("Environment mismatch", { status: 400 });
  try {
    event = await verifyWebhook(request, environment);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const object = event.data.object;
    let subscriptionId: string | null = null;
    if (object.object === "subscription") subscriptionId = object.id;
    else if (object.object === "invoice") {
      const subscription = object.parent?.subscription_details?.subscription;
      subscriptionId = typeof subscription === "string" ? subscription : (subscription?.id ?? null);
    } else if (object.object === "checkout.session") {
      const subscription = object.subscription;
      subscriptionId = typeof subscription === "string" ? subscription : (subscription?.id ?? null);
    }
    const accepted = new Set([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.trial_will_end",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ]);
    if (!accepted.has(event.type) || !subscriptionId) return Response.json({ received: true });
    // Fetch current state so delayed webhook delivery cannot restore an obsolete subscription.
    const stripe = createStripeClient(environment);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const customer =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const item = subscription.items.data[0];
    if (!item || subscription.items.data.length !== 1)
      throw new Error("Unrecognised subscription price");
    const price = item.price;
    const product = typeof price.product === "string" ? price.product : price.product.id;
    const history = await supabaseAdmin
      .from("billing_price_history")
      .select("*")
      .eq("price_id", price.id)
      .eq("environment", environment)
      .maybeSingle();
    if (history.error) throw new Error("Price history unavailable");
    let planKey: string;
    if (history.data) {
      const h = history.data;
      if (
        h.product_id !== product ||
        h.amount !== price.unit_amount ||
        price.currency !== "gbp" ||
        h.interval_name !== price.recurring?.interval ||
        price.recurring.interval_count !== 1
      )
        throw new Error("Invalid historical price");
      planKey = h.plan_key;
    } else {
      if (!price.lookup_key || (await validatedPrice(stripe, price.lookup_key)).id !== price.id)
        throw new Error("Subscription price mismatch");
      planKey = price.lookup_key.replace(/_(monthly|yearly)$/, "");
    }
    const invoice = subscription.latest_invoice;
    const paid = !!invoice && typeof invoice !== "string" && invoice.status === "paid";
    const { error } = await supabaseAdmin.rpc("apply_billing_event", {
      _event: event.id,
      _created: event.created,
      _environment: environment,
      _plan: planKey,
      _paid: paid,
      _subscription: {
        id: subscription.id,
        customer,
        product: typeof price.product === "string" ? price.product : price.product.id,
        price: price.id,
        status: subscription.status,
        interval: price.recurring?.interval,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        period_start: new Date(item.current_period_start * 1000).toISOString(),
        period_end: new Date(item.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    });
    if (error) throw new Error("Billing transaction failed");
    return Response.json({ received: true });
  } catch {
    console.error(JSON.stringify({ event: "stripe_webhook_failed", stripe_event_id: event.id }));
    return new Response("Retry webhook", { status: 503 });
  }
}
