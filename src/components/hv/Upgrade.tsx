import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { copyFor, effective, eligiblePlans, formatLimit, type Entitlements, type GateResult } from "@/lib/entitlements";
import { planByKey, priceLabel } from "@/lib/plans";
import { useInactivePlans } from "@/lib/plan-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "./store";

/** Published (approved) entitlement overrides per plan key. */
export async function fetchPublished(): Promise<Record<string, Entitlements>> {
  const { data } = await supabase.rpc("published_plan_entitlements");
  const out: Record<string, Entitlements> = {};
  for (const r of data ?? []) if (r.entitlements) out[r.plan_key] = r.entitlements as Entitlements;
  return out;
}
export function usePublished() {
  return useQuery({ queryKey: ["published-entitlements"], queryFn: fetchPublished, staleTime: 60_000 }).data ?? {};
}

type Blocked = Extract<GateResult, { ok: false }>;
let listener: ((b: Blocked) => void) | null = null;
/** Opens the upgrade modal; remembers where the user was so they can return after upgrading. */
export function openUpgrade(b: Blocked) {
  sessionStorage.setItem("hv-resume", window.location.pathname + window.location.search);
  listener?.(b);
}

/** Feature access for the signed-in user's plan. `need` opens the upgrade modal when locked. */
export function usePlanGate() {
  const { profile } = useStore();
  const published = usePublished();
  const plan = profile?.plan ?? "free";
  const ent = effective(plan, published[plan]);
  const can = (feature: string) => ent[feature]?.on !== false;
  const need = (feature: string, label: string) => {
    if (can(feature)) return true;
    openUpgrade({ ok: false, reason: "locked", feature, label });
    return false;
  };
  return { can, need, ent, plan };
}

export function UpgradeModal() {
  const [b, setB] = useState<Blocked | null>(null);
  const { profile } = useStore();
  const published = usePublished();
  const off = useInactivePlans();
  useEffect(() => { listener = setB; return () => { listener = null; }; }, []);
  if (!b) return null;
  const current = profile?.plan ?? "free";
  const eligible = eligiblePlans(current, b.feature, published, b.max).filter((k) => !off.has(k)).map(planByKey);
  const [title, body] = b.reason === "limit" ? [`You've reached your ${b.max?.toLocaleString("en-GB")}-${b.label.replace(/s$/, "")} limit`, `Your ${planByKey(current).name} plan allows ${b.max?.toLocaleString("en-GB")} ${b.label}. Upgrade to add more — what you've typed is kept.`] : copyFor(b.feature, b.label);
  const go = (plan?: string) => { window.location.href = `/app/plans?need=${encodeURIComponent(b.feature)}${b.max !== undefined ? `&over=${b.max}` : ""}${plan ? `&plan=${plan}` : ""}`; };
  return (
    <Dialog open onOpenChange={(o) => !o && setB(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{b.reason === "limit" ? <Lock className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        {b.reason === "locked" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Not included in your {planByKey(current).name} plan</p>}
        {eligible.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plans that unlock this</p>
            {eligible.slice(0, 3).map((p) => { const e = effective(p.key, published[p.key])[b.feature]; return (
              <button key={p.key} onClick={() => go(p.key)} className="flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition hover:border-primary hover:bg-secondary">
                <span><span className="block font-semibold">{p.name}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3 text-primary" />{e?.limit !== undefined ? `${formatLimit(e)} ${b.label}` : "Included"}</span></span>
                <span className="text-sm font-semibold">{priceLabel(p, false)}{p.monthly ? <span className="text-xs opacity-60">/mo</span> : null}</span>
              </button>); })}
          </div>
        ) : <p className="rounded-xl border bg-secondary/50 p-3 text-sm">No self-serve plan unlocks this yet — talk to us about Enterprise.</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => go()} className="flex-1 rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground">View eligible plans</button>
          <button onClick={() => setB(null)} className="rounded-full border px-5 text-sm">Not now</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
