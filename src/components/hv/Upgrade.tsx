import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { copyFor, type Entitlements, type GateResult } from "@/lib/entitlements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export function UpgradeModal() {
  const [b, setB] = useState<Blocked | null>(null);
  useEffect(() => { listener = setB; return () => { listener = null; }; }, []);
  if (!b) return null;
  const [title, body] = b.reason === "limit" ? [`You've reached your ${b.max?.toLocaleString("en-GB")}-${b.label.replace(/s$/, "")} limit`, `Your current plan allows ${b.max?.toLocaleString("en-GB")} ${b.label}. Upgrade to add more — what you've typed is kept.`] : copyFor(b.feature, b.label);
  const go = () => { window.location.href = `/app/plans?need=${encodeURIComponent(b.feature)}${b.max !== undefined ? `&over=${b.max}` : ""}`; };
  return (
    <Dialog open onOpenChange={(o) => !o && setB(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2">{b.reason === "limit" ? <Lock className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={go} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Compare plans</button>
          <button onClick={() => setB(null)} className="rounded-full border px-5 text-sm">Not now</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
