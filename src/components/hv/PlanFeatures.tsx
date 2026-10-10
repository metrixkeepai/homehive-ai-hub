import { useState } from "react";
import { catalogueFor, groupsFor, type Entitlements, type Unit } from "@/lib/entitlements";
import type { Audience } from "@/lib/plans";
import { Input } from "@/components/ui/input";

const units: Unit[] = ["count", "MB", "GB", "TB", "per month"];

/** Super Admin editor: which features a plan unlocks and its limits. */
export function PlanFeatures({ audience, value, onChange }: { audience: Audience; value: Entitlements; onChange: (v: Entitlements) => void }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "on" | "off">("all");
  const list = catalogueFor(audience);
  const set = (k: string, patch: Partial<Entitlements[string]>) => onChange({ ...value, [k]: { on: false, ...value[k], ...patch } });
  const onCount = list.filter((f) => value[f.key]?.on).length;
  const match = (f: (typeof list)[number]) => (!q || f.name.toLowerCase().includes(q.toLowerCase())) && (show === "all" || (show === "on") === !!value[f.key]?.on);
  return (
    <section className="space-y-3 md:col-span-2">
      <div>
        <h2 className="text-base font-semibold">Plan Features & Entitlements</h2>
        <p className="text-muted-foreground">Choose exactly what this plan unlocks and define limits where required. This controls actual product access — Benefits below stay as marketing copy.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features" className="max-w-xs" />
        <select value={show} onChange={(e) => setShow(e.target.value as any)} className="h-9 rounded-md border bg-background px-2"><option value="all">All features</option><option value="on">Enabled</option><option value="off">Disabled</option></select>
        <span className="text-muted-foreground">{onCount} of {list.length} features enabled</span>
      </div>
      {groupsFor(audience).map((g) => {
        const fs = list.filter((f) => f.group === g && match(f));
        if (!fs.length) return null;
        return (
          <details key={g} open={!!q || g === "Capacity"} className="rounded-lg border">
            <summary className="cursor-pointer select-none p-3 font-medium">{g} <span className="text-xs text-muted-foreground">· {fs.filter((f) => value[f.key]?.on).length}/{fs.length} on</span></summary>
            <div className="grid gap-2 p-3 pt-0 md:grid-cols-2">
              {fs.map((f) => { const e = value[f.key] ?? { on: false }; const unlimited = e.limit === null; return (
                <div key={f.key} className={`rounded-md border p-3 ${e.on ? "bg-primary/5" : ""}`}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={e.on} onChange={(x) => set(f.key, { on: x.target.checked, ...(f.limits && e.limit === undefined ? { limit: null, unit: f.unit } : {}) })} className="mt-1" />
                    <span><span className="font-medium">{f.name}</span><span className="block text-xs text-muted-foreground">{f.desc}</span><span className="text-xs">{e.on ? "Enabled" : "Disabled"}</span></span>
                  </label>
                  {f.limits && e.on && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                      <Input type="number" min={0} disabled={unlimited} value={unlimited ? "" : e.limit ?? ""} onChange={(x) => set(f.key, { limit: x.target.value === "" ? 0 : Number(x.target.value) })} className="h-8 w-28" aria-label={`Maximum ${f.name}`} />
                      <select value={e.unit ?? f.unit} onChange={(x) => set(f.key, { unit: x.target.value as Unit })} className="h-8 rounded-md border bg-background px-1 text-xs">{units.map((u) => <option key={u}>{u}</option>)}</select>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={unlimited} onChange={(x) => set(f.key, { limit: x.target.checked ? null : f.limits?.[0] ?? 0 })} />Unlimited</label>
                    </div>
                  )}
                </div>); })}
            </div>
          </details>
        );
      })}
    </section>
  );
}
