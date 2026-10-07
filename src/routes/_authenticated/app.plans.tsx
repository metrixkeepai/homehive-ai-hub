import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/components/hv/store";

export const Route = createFileRoute("/_authenticated/app/plans")({
  head: () => ({
    meta: [
      { title: "Choose your plan — MatrixKeep AI" },
      { name: "description", content: "Pick the MatrixKeep AI plan for your home, business or organisation, or redeem a voucher." },
      { property: "og:title", content: "Choose your plan — MatrixKeep AI" },
      { property: "og:description", content: "Plans for homes, businesses, enterprises and white-label partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

type Plan = { key: string; n: string; p: string; d: string; f: string[] };
const groups: Record<"individual" | "business" | "enterprise", Plan[]> = {
  individual: [
    { key: "free", n: "Free", p: "£0", d: "Get started with one home", f: ["50 items", "Basic AI agents", "1 member"] },
    { key: "home", n: "Home", p: "£4.99/mo", d: "Your whole home, organised", f: ["Unlimited items", "All AI agents", "Email import", "2 members"] },
    { key: "plus", n: "Home+", p: "£9.99/mo", d: "Property & vehicles too", f: ["Everything in Home", "Property passport", "Vehicles", "Claim packs"] },
    { key: "family", n: "Family", p: "£14.99/mo", d: "Built for the household", f: ["Everything in Home+", "6 members & roles", "Shared tasks", "Priority support"] },
  ],
  business: [
    { key: "free", n: "Starter", p: "£0", d: "Try it with one location", f: ["1 location", "100 assets", "2 team members"] },
    { key: "business", n: "Business", p: "£29/mo", d: "For growing SMEs", f: ["Up to 5 locations", "Unlimited assets", "10 team members", "Roles & permissions"] },
    { key: "business_pro", n: "Business Pro", p: "£79/mo", d: "Multi-branch operations", f: ["Up to 25 locations", "Audit trail", "Compliance reminders", "Priority support"] },
  ],
  enterprise: [
    { key: "enterprise", n: "Enterprise", p: "Custom", d: "Large organisations", f: ["Unlimited locations", "SSO & advanced roles", "Dedicated success manager", "Custom data retention"] },
    { key: "whitelabel", n: "White-label", p: "Custom", d: "Offer MatrixKeep under your brand", f: ["Your branding & domain", "Customer licensing", "Partner dashboard", "API access"] },
  ],
};
const names: Record<string, string> = Object.fromEntries(Object.values(groups).flat().map((p) => [p.key, p.n]));

function Plans() {
  const { profile, saveProfile, reload } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const kind = profile?.account_type ?? "individual";
  const list = kind === "enterprise" ? [...groups.business, ...groups.enterprise] : kind === "business" ? [...groups.business, ...groups.enterprise] : groups.individual;

  const redeem = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_voucher", { _code: c.trim() });
    setBusy(false);
    if (error || !data) { toast.error("That voucher code isn't valid or has been used up."); return; }
    localStorage.removeItem("hv-voucher");
    toast.success(`Voucher applied — you're on ${names[data] ?? data}`);
    setCode(""); await reload();
  };
  useEffect(() => {
    const pending = localStorage.getItem("hv-voucher");
    if (pending && profile) void redeem(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile]);

  const choose = async (p: Plan) => {
    if (p.key === "free") { if (await saveProfile({ plan: "free", plan_source: "self" })) toast.success("You're on the free plan"); return; }
    toast("Online payment isn't switched on yet", { description: p.p === "Custom" ? "Our team will contact you about this plan once sales enquiries go live." : "You can use a voucher code now, or stay on Free until card payments are available." });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Overview</Link> / <span className="text-foreground">Plans</span></nav>
      <div>
        <h1 className="font-display text-4xl">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">Current plan: <span className="font-semibold text-foreground">{names[profile?.plan ?? "free"] ?? profile?.plan}</span>{profile?.plan_source?.startsWith("voucher:") && ` (voucher ${profile.plan_source.slice(8)})`}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void redeem(code); }} className="flex max-w-md gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border bg-card px-4"><Ticket className="h-4 w-4 text-primary" /><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="Voucher code" className="w-full bg-transparent py-2.5 text-sm uppercase outline-none" /></div>
        <button disabled={busy} className="rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">Redeem</button>
      </form>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => {
          const cur = (profile?.plan ?? "free") === p.key;
          return (
            <div key={p.n} className={`flex flex-col rounded-3xl border bg-card p-6 shadow-soft ${cur ? "border-primary ring-2 ring-primary/30" : ""}`}>
              <p className="font-semibold">{p.n}</p>
              <p className="mt-2 font-display text-3xl">{p.p}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.f.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-success" />{f}</li>)}</ul>
              <button disabled={cur} onClick={() => choose(p)} className="mt-5 rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground disabled:bg-secondary disabled:bg-none disabled:text-muted-foreground">
                {cur ? "Current plan" : p.p === "Custom" ? "Talk to us" : "Choose"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Prices shown are draft prices. Card payments aren't connected yet.</p>
      <Link to="/app" className="inline-block rounded-full border px-5 py-2 text-sm font-semibold">Continue to my MatrixKeep</Link>
    </div>
  );
}
