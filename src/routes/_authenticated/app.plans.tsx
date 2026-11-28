import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trialBillingDate, voucherPrice, type VoucherOffer } from "@/lib/voucher-terms";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyPlanVoucher, chooseFreePlan } from "@/lib/payments.functions";
import { useStore } from "@/components/hv/store";
import { planByKey, trialInfo, type PlanDef } from "@/lib/plans";
import { useInactivePlans, usePublishedPlans } from "@/lib/plan-status";
import { eligiblePlans } from "@/lib/entitlements";
import { usePublished } from "@/components/hv/Upgrade";
import { PlanCard, BillingToggle, CompareTable } from "@/components/hv/PlanCard";
import { StripeEmbeddedCheckout } from "@/components/hv/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/hv/PaymentTestModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/plans")({
  head: () => ({
    meta: [
      { title: "Choose your plan — MatrixKeep AI" },
      {
        name: "description",
        content: "Compare MatrixKeep plans, start the Business Starter trial, or redeem a voucher.",
      },
      { property: "og:title", content: "Choose your plan — MatrixKeep AI" },
      {
        property: "og:description",
        content: "Plans for homes, businesses, enterprises and white-label partners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

function Plans() {
  const { profile, email, reload } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [checkout, setCheckout] = useState<PlanDef | null>(null);
  const kind = profile?.account_type ?? "individual";
  const off = useInactivePlans();
  const catalogue = usePublishedPlans();
  const offers = useQuery({
    queryKey: ["checkout-vouchers", email],
    enabled: !!email,
    queryFn: async () => {
      const r = await supabase.rpc("my_checkout_vouchers");
      if (r.error) throw r.error;
      return (r.data ?? []) as unknown as VoucherOffer[];
    },
  });
  const list = (catalogue.data ?? [])
    .filter((p) =>
      kind === "individual" ? p.audience === "individual" : p.audience !== "individual",
    )
    .filter((p) => !off.has(p.key) || p.key === profile?.plan);
  const published = usePublished();
  const [need, setNeed] = useState<{ feature: string; over?: number | undefined } | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const f = u.get("need");
    if (f) setNeed({ feature: f, over: u.get("over") ? Number(u.get("over")) : undefined });
    setResume(sessionStorage.getItem("hv-resume"));
  }, []);
  // "Choose" from the upgrade pop-up opens checkout for that plan straight away.
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("plan");
    const p = k && list.find((x) => x.key === k);
    if (p && profile && p.key !== profile.plan) void choose(p); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile, catalogue.isSuccess]);
  const eligible = need
    ? eligiblePlans(profile?.plan ?? "free", need.feature, published, need.over, catalogue.data)
    : [];
  const trial = trialInfo(profile?.trial_ends_at, profile?.plan_source);

  const checkoutOffer = offers.data?.find((v) => v.plan === checkout?.key);
  const checkoutPrice = checkout && (yearly ? checkout.yearly : checkout.monthly);
  const quotePence = checkoutPrice == null ? undefined : Math.round(checkoutPrice * 100);
  const redeem = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    const data = await applyPlanVoucher({ data: c.trim() }).catch(() => null);
    setBusy(false);
    if (!data) {
      toast.error("That voucher code isn't valid or has been used up.");
      return;
    }
    localStorage.removeItem("hv-voucher");
    const applied = await offers.refetch();
    const offer = applied.data?.find((v) => v.plan === data && v.code === c.trim().toUpperCase());
    toast.success(
      offer
        ? `${offer.code} applied to ${catalogue.data?.find((p) => p.key === data)?.name ?? data}`
        : `Voucher applied — ${catalogue.data?.find((p) => p.key === data)?.name ?? data}`,
    );
    setCode("");
    await reload();
  };
  useEffect(() => {
    const pending = localStorage.getItem("hv-voucher");
    if (pending && profile) void redeem(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile, catalogue.isSuccess]);

  const startTrial = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("start_business_trial");
    setBusy(false);
    if (error) {
      toast.error("Your free trial has already been used on this account.");
      return;
    }
    toast.success("Your 14-day Business Starter trial has started");
    await reload();
  };
  const choose = async (p: PlanDef) => {
    if ((yearly ? p.yearly : p.monthly) === 0) {
      setBusy(true);
      try {
        const result = await chooseFreePlan({ data: { planKey: p.key } });
        if (result.url) window.location.assign(result.url);
        else if (result.ok) {
          toast.success(`You're on ${p.name}. Your records are kept.`);
          await reload();
        } else toast.error(result.error ?? "Unable to change plan.");
      } catch {
        toast.error("Unable to change plan.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if ((yearly ? p.yearly : p.monthly) === null) {
      toast("Talk to us", {
        description: "Use the Contact page and our team will set up this plan with you.",
      });
      return;
    }
    setCheckout(p);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
      <PaymentTestModeBanner />
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">
          Overview
        </Link>{" "}
        / <span className="text-foreground">Plans</span>
      </nav>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">
          Current plan:{" "}
          <span className="font-semibold text-foreground">
            {catalogue.data?.find((p) => p.key === profile?.plan)?.name ??
              planByKey(profile?.plan).name}
          </span>
          {trial && (trial.expired ? " · trial ended" : ` · trial, ${trial.days} days left`)}
          {profile?.plan_source?.startsWith("voucher:") &&
            ` (voucher ${profile.plan_source.slice(8)})`}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void redeem(code);
        }}
        className="flex max-w-md gap-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border bg-card px-4">
          <Ticket className="h-4 w-4 text-primary" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            placeholder="Voucher code"
            className="min-w-0 w-full bg-transparent py-2.5 text-base uppercase outline-none sm:text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Redeem
        </button>
      </form>
      {offers.data?.map((offer) => (
        <button
          key={offer.plan}
          className="text-sm underline"
          onClick={async () => {
            const result = await supabase.rpc("remove_checkout_voucher", { _plan: offer.plan });
            if (result.error) toast.error("Could not remove the voucher");
            else await offers.refetch();
          }}
        >
          Remove {offer.code}
        </button>
      ))}
      {need && (
        <p className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
          {eligible.length ? (
            <>Plans that unlock this are highlighted below.</>
          ) : (
            <>No self-serve plan unlocks this — talk to us about Enterprise.</>
          )}
        </p>
      )}
      {resume && (
        <a
          href={resume}
          onClick={() => sessionStorage.removeItem("hv-resume")}
          className="inline-block text-sm font-semibold text-primary"
        >
          ← Return to what you were doing
        </a>
      )}
      <BillingToggle yearly={yearly} onChange={setYearly} />
      <div className="grid gap-6 pt-2 md:grid-cols-2 xl:grid-cols-4">
        {catalogue.isPending && <p role="status">Loading plans…</p>}
        {catalogue.isError && (
          <button onClick={() => void catalogue.refetch()}>Retry loading plans</button>
        )}
        {list.map((p) => {
          const cur = (profile?.plan ?? "free") === p.key;
          const offer = offers.data?.find((v) => v.plan === p.key);
          const amount = yearly ? p.yearly : p.monthly;
          return (
            <PlanCard
              key={p.key}
              p={p}
              yearly={yearly}
              current={cur}
              voucher={
                offer && amount != null
                  ? {
                      code: offer.code,
                      detail:
                        offer.type === "discount_percent"
                          ? offer.value + "% off"
                          : offer.type === "discount_fixed"
                            ? "£" + offer.value + " off"
                            : offer.end
                              ? "Free through " + offer.end
                              : "Free for " + offer.months + " months",
                      price: voucherPrice(Math.round(amount * 100), offer) / 100,
                      duration:
                        offer.type === "free_period"
                          ? "£" +
                            amount +
                            " per " +
                            (yearly ? "year" : "month") +
                            " from " +
                            trialBillingDate(offer)
                          : offer.end
                            ? "Through " + offer.end
                            : offer.months
                              ? "For " + offer.months + " months"
                              : "Recurring discount",
                    }
                  : undefined
              }
              highlight={need ? eligible.includes(p.key) : p.badge === "Most popular"}
              cta={
                cur && profile?.plan_source === "stripe" ? (
                  <button
                    onClick={() => choose(p)}
                    className="w-full rounded-full border py-2.5 text-sm font-semibold"
                  >
                    Review {yearly ? "yearly" : "monthly"} billing
                  </button>
                ) : cur ? (
                  <button
                    disabled
                    className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    Current plan
                  </button>
                ) : (
                  <>
                    {p.trialDays && !profile?.trial_ends_at && (
                      <button
                        disabled={busy}
                        onClick={startTrial}
                        className="w-full rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground"
                      >
                        Start 14-day free trial
                      </button>
                    )}
                    <button
                      onClick={() => choose(p)}
                      className={`w-full rounded-full py-2.5 text-sm font-semibold ${p.trialDays && !profile?.trial_ends_at ? "border" : "bg-aurora text-primary-foreground"}`}
                    >
                      {(yearly ? p.yearly : p.monthly) === null
                        ? "Talk to us"
                        : p.monthly === 0
                          ? "Switch to Free"
                          : p.trialDays
                            ? "Buy now"
                            : `Choose ${p.name}`}
                    </button>
                  </>
                )
              }
            />
          );
        })}
      </div>
      <CompareTable list={list} />
      <Dialog
        open={!!checkout}
        onOpenChange={(o) => {
          if (!o) {
            setCheckout(null);
            void reload();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {checkout ? `Subscribe to ${checkout.name} — ${yearly ? "yearly" : "monthly"}` : ""}
            </DialogTitle>
          </DialogHeader>
          {checkout && (
            <StripeEmbeddedCheckout
              expectedVoucher={checkoutOffer?.code ?? null}
              expectedPence={
                checkoutOffer && quotePence !== undefined
                  ? voucherPrice(quotePence, checkoutOffer)
                  : quotePence
              }
              plan={checkout.key}
              interval={yearly ? "yearly" : "monthly"}
            />
          )}
        </DialogContent>
      </Dialog>
      <Link
        to="/app/$section"
        params={{ section: "billing" }}
        className="inline-block rounded-full border px-5 py-2 text-sm font-semibold"
      >
        See my usage & billing
      </Link>
    </div>
  );
}
