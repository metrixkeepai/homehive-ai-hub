import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/components/hv/store";
import { planByKey, plansFor, trialInfo, type PlanDef } from "@/lib/plans";
import { PlanCard, BillingToggle, CompareTable } from "@/components/hv/PlanCard";

export const Route = createFileRoute("/_authenticated/app/plans")({
  head: () => ({
    meta: [
      { title: "Choose your plan — MatrixKeep AI" },
      { name: "description", content: "Compare MatrixKeep plans, start the Business Starter trial, or redeem a voucher." },
      { property: "og:title", content: "Choose your plan — MatrixKeep AI" },
      { property: "og:description", content: "Plans for homes, businesses, enterprises and white-label partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

function Plans() {
  const { profile, saveProfile, reload } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [yearly, setYearly] = useState(false);
  const kind = profile?.account_type ?? "individual";
  const list = plansFor(kind);
  const trial = trialInfo(profile?.trial_ends_at, profile?.plan_source);

  const redeem = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_voucher", { _code: c.trim() });
    setBusy(false);
    if (error || !data) { toast.error("That voucher code isn't valid or has been used up."); return; }
    localStorage.removeItem("hv-voucher");
    toast.success(`Voucher applied — you're on ${planByKey(data).name}`);
    setCode(""); await reload();
  };
  useEffect(() => {
    const pending = localStorage.getItem("hv-voucher");
    if (pending && profile) void redeem(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile]);

  const startTrial = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("start_business_trial");
    setBusy(false);
    if (error) { toast.error("Your free trial has already been used on this account."); return; }
    toast.success("Your 14-day Business Starter trial has started"); await reload();
  };
  const choose = async (p: PlanDef) => {
    if (p.monthly === 0) { if (await saveProfile({ plan: "free", plan_source: "self" })) toast.success("You're on the Free plan — your records are kept"); return; }
    toast("Card payments aren't switched on yet", { description: p.monthly === null ? "Use the Contact page and our team will set up this plan with you." : "Your plan hasn't changed. Use a voucher code, or the trial on Business Starter, until card payments are available." });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Overview</Link> / <span className="text-foreground">Plans</span></nav>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">Current plan: <span className="font-semibold text-foreground">{planByKey(profile?.plan).name}</span>
          {trial && (trial.expired ? " · trial ended" : ` · trial, ${trial.days} days left`)}
          {profile?.plan_source?.startsWith("voucher:") && ` (voucher ${profile.plan_source.slice(8)})`}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void redeem(code); }} className="flex max-w-md gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border bg-card px-4"><Ticket className="h-4 w-4 text-primary" /><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="Voucher code" className="w-full bg-transparent py-2.5 text-base uppercase outline-none sm:text-sm" /></div>
        <button disabled={busy} className="rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">Redeem</button>
      </form>
      <BillingToggle yearly={yearly} onChange={setYearly} />
      <div className="grid gap-6 pt-2 md:grid-cols-2 xl:grid-cols-4">
        {list.map((p) => {
          const cur = (profile?.plan ?? "free") === p.key;
          return <PlanCard key={p.key} p={p} yearly={yearly} current={cur} highlight={p.badge === "Most popular"} cta={
            cur ? <button disabled className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-muted-foreground">Current plan</button> : <>
              {p.trialDays && !profile?.trial_ends_at && <button disabled={busy} onClick={startTrial} className="w-full rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground">Start 14-day free trial</button>}
              <button onClick={() => choose(p)} className={`w-full rounded-full py-2.5 text-sm font-semibold ${p.trialDays && !profile?.trial_ends_at ? "border" : "bg-aurora text-primary-foreground"}`}>{p.monthly === null ? "Talk to us" : p.monthly === 0 ? "Switch to Free" : p.trialDays ? "Buy now" : `Choose ${p.name}`}</button>
            </>
          } />;
        })}
      </div>
      <CompareTable list={list} />
      <p className="text-xs text-muted-foreground">Card payments aren't connected yet, so paid plans can't be bought here. Vouchers and the Business Starter trial work now.</p>
      <Link to="/app/$section" params={{ section: "billing" }} className="inline-block rounded-full border px-5 py-2 text-sm font-semibold">See my usage & billing</Link>
    </div>
  );
}
