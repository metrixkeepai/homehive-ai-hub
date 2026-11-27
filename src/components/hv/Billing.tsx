import { useState } from "react";
import { toast } from "sonner";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publicSetting } from "@/lib/public-config";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { useStore } from "./store";
import { useCurrentPlan, usePublishedPlans } from "@/lib/plan-status";
import { nextPlan, trialInfo, gbp } from "@/lib/plans";

export function BillingPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const paymentsEnabled = Boolean(publicSetting("VITE_PAYMENTS_CLIENT_TOKEN"));
  const subscription = useQuery({
    queryKey: ["my-subscription", user.id],
    enabled: paymentsEnabled,
    queryFn: async () => {
      const query = () =>
        supabase
          .from("subscriptions")
          .select("status,billing_interval,current_period_end,cancel_at_period_end,trial_end")
          .eq("user_id", user.id)
          .eq("environment", getStripeEnvironment())
          .order("updated_at", { ascending: false })
          .limit(1);
      const current = await query()
        .not("status", "in", "(canceled,incomplete_expired)")
        .maybeSingle();
      if (current.error) throw new Error("Subscription details unavailable");
      if (current.data) return current.data;
      const latest = await query().maybeSingle();
      if (latest.error) throw new Error("Subscription details unavailable");
      return latest.data;
    },
  });
  const usage = useQuery({
    queryKey: ["my-ai-allowances", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_ai_allowances");
      if (error) throw error;
      return data;
    },
  });
  const sub = subscription.data;
  const [busy, setBusy] = useState(false);
  const portal = async () => {
    setBusy(true);
    try {
      const result = await createPortalSession({ data: { environment: getStripeEnvironment() } });
      if ("url" in result) window.location.assign(result.url);
      else toast.error(result.error);
    } catch {
      toast.error("Billing is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const { profile, added, current } = useStore();
  const p = useCurrentPlan(profile?.plan);
  const catalogue = usePublishedPlans();
  const nextKey = nextPlan(p.key)?.key;
  const up = catalogue.data?.find((item) => item.key === nextKey);
  const trial = trialInfo(profile?.trial_ends_at, profile?.plan_source);
  const n = (...s: string[]) => s.reduce((a, k) => a + (added[k]?.length ?? 0), 0);
  const biz = current.type !== "individual";
  const meters: [string, number, number][] = [
    ["Assets & vehicles", n("assets", "vehicles"), p.limits.assets],
    ["Documents", n("documents", "warranties", "renewals", "insurance"), p.limits.docs],
    [biz ? "Team members" : "Household members", 1 + n(biz ? "team" : "family"), p.limits.users],
    [
      biz ? "Locations" : "Properties",
      Math.max(1, n(biz ? "locations" : "my-home")),
      p.limits.places,
    ],
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">
          Overview
        </Link>{" "}
        / <span className="text-foreground">Subscription & billing</span>
      </nav>
      <h1 className="font-display text-3xl sm:text-4xl">Subscription & billing</h1>
      {trial && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm ${trial.expired ? "border-destructive/40 bg-destructive/10" : "border-primary/30 bg-primary/10"}`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {trial.expired
              ? "Your Business Starter trial has ended. Your records are safe — choose a plan to keep adding."
              : `Business Starter trial: ${trial.days} days left (ends ${trial.ends.toLocaleDateString("en-GB")}). Choose a paid plan to continue; there is no automatic charge.`}
          </span>
          <Link
            to="/app/plans"
            className="rounded-full bg-aurora px-4 py-1.5 font-semibold text-primary-foreground"
          >
            Choose a plan
          </Link>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-card p-6 shadow-soft md:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-3xl">{p.name}</p>
          <p className="text-sm text-muted-foreground">
            {p.monthly === null
              ? "Custom contract"
              : p.monthly === 0
                ? "Free"
                : `${gbp(p.monthly)}/month or ${gbp(p.yearly!)}/year`}{" "}
            ·{" "}
            {trial
              ? "Trial"
              : profile?.plan_source?.startsWith("voucher:")
                ? `Voucher ${profile.plan_source.slice(8)}`
                : sub
                  ? sub.status.replaceAll("_", " ")
                  : profile?.plan_source === "stripe"
                    ? "Card billing"
                    : "Active"}
          </p>
          {sub?.current_period_end && ["active", "trialing"].includes(sub.status) && (
            <p className="mt-2 text-sm">
              {sub.cancel_at_period_end
                ? "Access ends"
                : sub.status === "trialing"
                  ? "Trial ends"
                  : "Renews"}{" "}
              {new Date(
                (sub.status === "trialing" && !sub.cancel_at_period_end && sub.trial_end) ||
                  sub.current_period_end,
              ).toLocaleDateString("en-GB")}
              {sub.billing_interval &&
                " · Billed " + (sub.billing_interval === "year" ? "yearly" : "monthly")}
            </p>
          )}
          {subscription.isError && (
            <p className="mt-2 text-sm">Subscription details are temporarily unavailable.</p>
          )}
          <p className="mt-3 text-sm">{p.outcome}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/plans"
              className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Change plan
            </Link>
          </div>
        </div>
        {up && (
          <Link
            to="/app/plans"
            className="group rounded-3xl border bg-midnight p-6 text-midnight-foreground shadow-glow"
          >
            <p className="text-xs uppercase tracking-wider opacity-70">Recommended next</p>
            <p className="mt-1 flex items-center gap-1 font-display text-2xl">
              {up.name}
              <ArrowUpRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
            </p>
            <p className="mt-2 text-sm opacity-80">
              {up.cap.users} · {up.cap.places} · {up.cap.assets} · {up.cap.storage}
            </p>
          </Link>
        )}
      </div>
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-semibold">Usage in {current.name}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {meters.map(([l, used, max]) => {
            const pct = Number.isFinite(max) ? Math.min(100, Math.round((used / max) * 100)) : 0;
            return (
              <div key={l}>
                <div className="flex justify-between text-sm">
                  <span>{l}</span>
                  <span className="text-muted-foreground">
                    {used} / {Number.isFinite(max) ? max.toLocaleString("en-GB") : "Contracted"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div
                    className={`h-2 rounded-full ${pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct >= 80 && (
                  <p className="mt-1 text-xs text-warning">You're close to your limit.</p>
                )}
              </div>
            );
          })}
        </div>
        {usage.data?.map((row) => (
          <p key={row.feature} className="mt-3 text-sm">
            {row.feature === "ai_captures"
              ? "Account AI captures (including recorded speech)"
              : "Account Sera voice minutes"}
            :{" "}
            {row.enabled
              ? row.used + " / " + (row.monthly_limit ?? "Unlimited")
              : "Unavailable on this plan"}{" "}
            · Resets {new Date(row.resets_at).toLocaleDateString("en-GB", { timeZone: "UTC" })} UTC
          </p>
        ))}
        {usage.isError && <p>AI usage is temporarily unavailable.</p>}
        <p className="mt-4 text-xs text-muted-foreground">
          Storage {p.cap.storage} · {p.cap.captures} · {p.cap.sera}. Counts include records you've
          saved yourself.
        </p>
      </div>
      <div className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground shadow-soft">
        <h2 className="font-semibold text-foreground">Payment method & invoices</h2>
        <button
          disabled={busy || !paymentsEnabled}
          onClick={portal}
          className="mt-3 rounded-full border px-5 py-3 font-semibold"
        >
          {busy ? "Opening billing…" : "Manage subscription, payment method & invoices"}
        </button>
        <p className="mt-2">
          {paymentsEnabled
            ? "Use the billing portal to manage your card-billed subscription and view invoices."
            : "Card billing is currently unavailable."}
        </p>
      </div>
    </div>
  );
}
