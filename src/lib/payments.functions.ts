import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
  stripeEnvironment,
} from "@/lib/stripe.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .union([
        z.object({
          plan: z.string().regex(/^[a-z0-9_]{2,40}$/),
          interval: z.enum(["monthly", "yearly"]),
        }),
        // Open tabs on the previous release can still use their validated lookup and origin.
        z.object({
          priceId: z.string().max(80),
          returnUrl: z.string().max(2048),
          environment: z.enum(["sandbox", "live"]),
        }),
      ])
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ clientSecret: string } | { portalUrl: string } | { error: string }> => {
      try {
        const { trustedReturnUrl } = await import("./app-origin.server");
        const lookup = "plan" in data ? data.plan + "_" + data.interval : data.priceId;
        const environment = "environment" in data ? data.environment : stripeEnvironment();
        const returnUrl = trustedReturnUrl(
          "returnUrl" in data ? data.returnUrl : undefined,
          "/app/plans",
        );
        const { customerForUser, validatedPrice, requireBillingEnvironment } =
          await import("./stripe-billing.server");
        const stripe = createStripeClient(environment);
        await requireBillingEnvironment(environment);
        const price = await validatedPrice(stripe, lookup);
        const { data: profile, error: profileError } = await context.supabase
          .from("profiles")
          .select("suspended")
          .eq("id", context.userId)
          .single();
        if (profileError || !profile || profile.suspended) throw new Error("Account unavailable");
        const { data: status, error: statusError } = await context.supabase
          .from("plan_status")
          .select("active")
          .eq("plan_key", lookup.replace(/_(monthly|yearly)$/, ""))
          .maybeSingle();
        if (statusError || status?.active === false) throw new Error("Plan unavailable");
        const {
          data: { user },
        } = await context.supabase.auth.getUser();
        const customer = await customerForUser(stripe, context.userId, environment, user?.email);
        const { withBillingLock } = await import("./billing-catalogue.server");
        return await withBillingLock(
          "checkout:" + environment + ":" + context.userId,
          async (token) => {
            const open = await stripe.checkout.sessions.list({
              customer,
              status: "open",
              limit: 100,
              expand: ["data.line_items"],
            });
            if (open.has_more) throw new Error("Checkout reconciliation required");
            let reusable: { id: string; secret: string } | null = null;
            for (const prior of open.data) {
              if (
                prior.mode !== "subscription" ||
                prior.metadata?.["app"] !== "matrixkeep" ||
                prior.client_reference_id !== context.userId
              )
                continue;
              if (
                !reusable &&
                prior.line_items?.data[0]?.price?.id === price.id &&
                prior.adaptive_pricing?.enabled === false &&
                prior.return_url === returnUrl &&
                prior.client_secret
              ) {
                reusable = { id: prior.id, secret: prior.client_secret };
                continue;
              }
              await stripe.checkout.sessions.expire(prior.id);
            }
            const subscriptions = await stripe.subscriptions.list({
              customer,
              status: "all",
              limit: 100,
            });
            const current = subscriptions.data.filter(
              (s) => !["canceled", "incomplete_expired"].includes(s.status),
            );
            const subscription = current[0];
            if (subscription) {
              if (reusable) await stripe.checkout.sessions.expire(reusable.id);
              const item = subscription.items.data[0];
              const canChange =
                current.length === 1 &&
                !subscriptions.has_more &&
                ["active", "trialing"].includes(subscription.status) &&
                !subscription.cancel_at_period_end &&
                subscription.collection_method === "charge_automatically" &&
                subscription.items.data.length === 1 &&
                item &&
                item.price.id !== price.id;
              const portal = await stripe.billingPortal.sessions.create({
                customer,
                return_url: returnUrl,
                ...(canChange
                  ? {
                      flow_data: {
                        type: "subscription_update_confirm" as const,
                        subscription_update_confirm: {
                          subscription: subscription.id,
                          items: [{ id: item.id, price: price.id, quantity: item.quantity ?? 1 }],
                        },
                        after_completion: {
                          type: "redirect" as const,
                          redirect: { return_url: returnUrl },
                        },
                      },
                    }
                  : {}),
              });
              return { portalUrl: portal.url };
            }
            if (reusable) return { clientSecret: reusable.secret };
            const session = await stripe.checkout.sessions.create(
              {
                mode: "subscription",
                ui_mode: "embedded_page",
                adaptive_pricing: { enabled: false },
                customer,
                line_items: [{ price: price.id, quantity: 1 }],
                return_url: returnUrl,
                client_reference_id: context.userId,
                metadata: { userId: context.userId, app: "matrixkeep" },
                subscription_data: { metadata: { userId: context.userId, app: "matrixkeep" } },
              },
              {
                idempotencyKey: `matrixkeep-checkout-${environment}-${context.userId}-${token}`,
              },
            );
            if (!session.client_secret) throw new Error("Checkout unavailable");
            return { clientSecret: session.client_secret };
          },
        );
      } catch (error) {
        const providerError = error as { type?: string; code?: string; requestId?: string };
        const safe = (value: unknown) =>
          typeof value === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(value) ? value : undefined;
        console.error(
          JSON.stringify({
            event: "checkout_failed",
            type: safe(providerError?.type),
            code: safe(providerError?.code),
            request: safe(providerError?.requestId),
            reason:
              error instanceof Error &&
              [
                "Billing database environment mismatch",
                "Price configuration mismatch",
                "Unknown plan",
                "Plan unavailable",
                "Account unavailable",
                "Billing binding failed",
                "Billing lookup failed",
              ].includes(error.message)
                ? error.message
                : undefined,
          }),
        );
        return { error: getStripeErrorMessage(error) };
      }
    },
  );

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
  .inputValidator((value: unknown) =>
    z
      .object({ planKey: z.string().regex(/^[a-z0-9_]{2,40}$/) })
      .optional()
      .parse(value),
  )
  .handler(async ({ context, data }): Promise<{ url?: string; ok?: boolean; error?: string }> => {
    const { stripeEnvironment } = await import("./stripe.server");
    const { existingCustomer } = await import("./stripe-billing.server");
    const { getAppOrigin } = await import("./app-origin.server");
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    try {
      const selected = data?.planKey ?? "free";
      const { cataloguePlan } = await import("./billing-catalogue.server");
      const terms = await cataloguePlan(selected);
      if (!terms || terms.monthly !== 0 || terms.yearly !== 0)
        throw new Error("Free plan unavailable");
      const status = await supabaseAdmin
        .from("plan_status")
        .select("active")
        .eq("plan_key", selected)
        .maybeSingle();
      if (status.error || status.data?.active === false) throw new Error("Free plan unavailable");
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
        .update({ plan: selected, plan_source: "self", updated_at: new Date().toISOString() })
        .eq("id", context.userId);
      if (error) throw new Error("Plan change failed");
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
