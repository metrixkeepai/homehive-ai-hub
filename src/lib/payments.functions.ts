import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { plans } from "./plans";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        priceId: z.string().max(80),
        returnUrl: z.string().max(2048),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { trustedReturnUrl } = await import("./app-origin.server");
      const returnUrl = trustedReturnUrl(data.returnUrl, "/app/plans");
      const { customerForUser, validatedPrice } = await import("./stripe-billing.server");
      const stripe = createStripeClient(data.environment);
      const price = await validatedPrice(stripe, data.priceId);
      const { data: profile, error: profileError } = await context.supabase
        .from("profiles")
        .select("suspended")
        .eq("id", context.userId)
        .single();
      if (profileError || !profile || profile.suspended) throw new Error("Account unavailable");
      const { data: status, error: statusError } = await context.supabase
        .from("plan_status")
        .select("active")
        .eq("plan_key", data.priceId.replace(/_(monthly|yearly)$/, ""))
        .maybeSingle();
      if (statusError || status?.active === false) throw new Error("Plan unavailable");
      const {
        data: { user },
      } = await context.supabase.auth.getUser();
      const customer = await customerForUser(stripe, context.userId, data.environment, user?.email);
      const subscriptions = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      });
      if (subscriptions.data.some((s) => !["canceled", "incomplete_expired"].includes(s.status)))
        return { error: "Manage your existing subscription in Billing to change plans." };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          ui_mode: "embedded_page",
          customer,
          line_items: [{ price: price.id, quantity: 1 }],
          return_url: returnUrl,
          client_reference_id: context.userId,
          metadata: { userId: context.userId, app: "matrixkeep" },
          subscription_data: { metadata: { userId: context.userId, app: "matrixkeep" } },
          integration_identifier: "matrixkeep_production_qmxtabcn",
        },
        {
          idempotencyKey: `matrixkeep-checkout-${data.environment}-${context.userId}-${Math.floor(Date.now() / 1_800_000)}`,
        },
      );
      if (!session.client_secret) throw new Error("Checkout unavailable");
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        returnUrl: z.string().max(2048).optional(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { trustedReturnUrl } = await import("./app-origin.server");
    const returnUrl = trustedReturnUrl(data.returnUrl, "/app/billing");
    try {
      const stripe = createStripeClient(data.environment);
      const { existingCustomer } = await import("./stripe-billing.server");
      const customer = await existingCustomer(context.userId, data.environment);
      if (!customer) return { error: "No card-billed subscription found." };
      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url: returnUrl,
      });
      return { url: session.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const chooseFreePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url?: string; ok?: boolean; error?: string }> => {
    const { stripeEnvironment } = await import("./stripe.server");
    const { existingCustomer } = await import("./stripe-billing.server");
    const { getAppOrigin } = await import("./app-origin.server");
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    try {
      const environment = stripeEnvironment();
      const customer = await existingCustomer(context.userId, environment);
      const { data: profile, error: profileError } = await context.supabase
        .from("profiles")
        .select("plan_source,suspended")
        .eq("id", context.userId)
        .single();
      if (profileError || profile.suspended || (!customer && profile.plan_source === "stripe"))
        throw new Error("Billing account needs reconciliation");
      if (customer) {
        const stripe = createStripeClient(environment);
        const subscriptions = await stripe.subscriptions.list({
          customer,
          status: "all",
          limit: 100,
        });
        if (
          subscriptions.data.some((s) => !["canceled", "incomplete_expired"].includes(s.status))
        ) {
          const portal = await stripe.billingPortal.sessions.create({
            customer,
            return_url: `${getAppOrigin()}/app/billing`,
          });
          return { url: portal.url };
        }
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ plan: "free", plan_source: "self", updated_at: new Date().toISOString() })
        .eq("id", context.userId);
      if (error) throw new Error("Plan change failed");
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
