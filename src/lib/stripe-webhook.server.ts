import type Stripe from "stripe";
import { createStripeClient, stripeEnvironment, verifyWebhook } from "./stripe.server";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { validatedPrice } from "./stripe-billing.server";

export async function handleStripeWebhook(request: Request) {
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
    if (!item || subscription.items.data.length !== 1 || !item.price.lookup_key)
      throw new Error("Unrecognised subscription price");
    const price = await validatedPrice(stripe, item.price.lookup_key);
    if (price.id !== item.price.id) throw new Error("Subscription price mismatch");
    const invoice = subscription.latest_invoice;
    const paid = !!invoice && typeof invoice !== "string" && invoice.status === "paid";
    const { error } = await supabaseAdmin.rpc("apply_billing_event", {
      _event: event.id,
      _created: event.created,
      _environment: environment,
      _plan: item.price.lookup_key.replace(/_(monthly|yearly)$/, ""),
      _paid: paid,
      _subscription: {
        id: subscription.id,
        customer,
        product: typeof price.product === "string" ? price.product : price.product.id,
        price: price.id,
        status: subscription.status,
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
