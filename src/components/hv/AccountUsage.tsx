import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { accountUsage, setLimitOverride } from "@/lib/account-usage.functions";
import { DataTable, bytes } from "@/components/hv/BillingKit";
import { Kpi, money, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const tone = { ok: "bg-primary", warning: "bg-amber-500", critical: "bg-orange-600", over: "bg-destructive" } as const;
const label = { ok: "Healthy", warning: "Near limit (75%+)", critical: "Critical (90%+)", over: "Over limit" } as const;
const pie = ["var(--primary)", "#16a34a", "#f59e0b", "var(--muted-foreground)"];

export function AccountUsage({ id }: { id: string }) {
  const fn = useServerFn(accountUsage), setFn = useServerFn(setLimitOverride);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "usage", id], queryFn: () => fn({ data: { id } }), retry: 2 });
  const [key, setKey] = useState<"storage" | "docs" | "assets">("storage");
  const [val, setVal] = useState(""); const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: (clear: boolean) => setFn({ data: { id, key, reason, value: clear ? null : Math.round(Number(val) * (key === "storage" ? 1024 ** 3 : 1)) } }),
    onSuccess: () => { toast.success("Limit updated"); setVal(""); setReason(""); qc.invalidateQueries({ queryKey: ["admin", "usage", id] }); },
    onError: (e: Error) => toast.error(/reason|\[/.test(e.message) ? "Enter a positive number and a reason of at least 3 characters" : e.message),
  });
  if (q.isLoading) return <p className="text-muted-foreground">Loading usage…</p>;
  if (q.error || !q.data) return <div className="space-y-2"><p className="text-destructive">Couldn't load usage.</p><Button variant="outline" onClick={() => q.refetch()}>Try again</Button></div>;
  const d = q.data;
  const fmt = (unit: string, n: number) => (unit === "bytes" ? bytes(n) : n.toLocaleString("en-GB"));
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold text-foreground">Plan limits & current usage — {d.plan.name}</h2>
        <div className="mt-4 space-y-4">
          {d.meters.map((x) => {
            const pct = x.limit ? Math.min(100, (x.used / x.limit) * 100) : 0;
            return (
              <div key={x.key}>
                <div className="flex justify-between"><span>{x.label}{x.overridden && <span className="ml-2 rounded bg-muted px-1.5 text-xs">admin override</span>}</span><span className="text-muted-foreground">{fmt(x.unit, x.used)} of {x.limit === null ? "unlimited" : fmt(x.unit, x.limit)} · {label[x.status]}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${tone[x.status]}`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-[auto_8rem_1fr_auto_auto]">
          <select aria-label="Limit" value={key} onChange={(e) => setKey(e.target.value as typeof key)} className="rounded-md border bg-background px-2"><option value="storage">Storage (GB)</option><option value="docs">Documents</option><option value="assets">Records</option></select>
          <Input type="number" min={1} placeholder="New limit" value={val} onChange={(e) => setVal(e.target.value)} />
          <Input placeholder="Reason (saved to audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={m.isPending || !val} onClick={() => m.mutate(false)}>Override</Button>
          <Button variant="outline" disabled={m.isPending || !(key in d.overrides)} onClick={() => m.mutate(true)}>Reset to plan</Button>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Storage used" value={bytes(d.meters[0]!.used)} hint={`Plan includes ${d.plan.storage}`} />
        <Kpi label="Documents & photos" value={d.files.length} />
        <Kpi label="AI requests" value={d.ai.requests} hint={d.ai.cost ? `${money(d.ai.cost, "USD")} cost` : undefined} />
        <Kpi label="Plan source" value={d.plan.source ?? "free"} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Storage by file type</h2>{d.byType.length ? <div className="mt-4 h-52"><ResponsiveContainer><PieChart><Pie data={d.byType} dataKey="bytes" nameKey="name" outerRadius={75} label={(e: any) => e.name}>{d.byType.map((_, i) => <Cell key={i} fill={pie[i % pie.length]} />)}</Pie><Tooltip formatter={(v: any) => bytes(Number(v))} /></PieChart></ResponsiveContainer></div> : <p className="mt-2 text-sm text-muted-foreground">No files uploaded yet.</p>}</section>
        <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Uploads per month</h2>{d.monthly.length ? <div className="mt-4 h-52"><ResponsiveContainer><BarChart data={d.monthly}><XAxis dataKey="month" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="files" fill="var(--primary)" /></BarChart></ResponsiveContainer></div> : <p className="mt-2 text-sm text-muted-foreground">No uploads yet.</p>}</section>
        <section className="rounded-xl border bg-card p-5 lg:col-span-2"><h2 className="font-semibold">Records by section</h2>{d.bySection.length ? <div className="mt-4 h-52"><ResponsiveContainer><BarChart data={d.bySection}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="var(--primary)" /></BarChart></ResponsiveContainer></div> : <p className="mt-2 text-sm text-muted-foreground">No records yet.</p>}</section>
      </div>
      <section className="space-y-3"><h2 className="font-semibold text-foreground">Documents & files</h2>
        <DataTable name="account-documents" rows={d.files} filters={[{ key: "type", label: "Types" }]} cols={[{ key: "name", label: "File" }, { key: "type", label: "Type" }, { key: "size", label: "Size", render: (r) => bytes(r.size) }, { key: "record", label: "Attached to" }, { key: "created", label: "Uploaded", render: (r) => when(r.created) }]} />
      </section>
      <section className="space-y-3"><h2 className="font-semibold text-foreground">Subscription history</h2>
        <DataTable name="subscription-history" rows={d.subs.map((s, i) => ({ id: String(i), ...s }))} filters={[{ key: "source", label: "Sources" }]} cols={[{ key: "date", label: "Date", render: (r) => (r.date ? when(r.date) : "—") }, { key: "event", label: "Event" }, { key: "plan", label: "Plan" }, { key: "source", label: "Source" }]} />
      </section>
      <section className="rounded-xl border border-dashed bg-card p-5 text-sm">
        <h2 className="font-semibold text-foreground">Invoices, payments & transactions</h2>
        <p className="mt-1 text-muted-foreground">{d.stripeConnected ? "Open Billing to see this customer's Stripe invoices and payments (search by their email)." : "No card payments are connected yet, so this account has no invoices or payments. They'll appear once Stripe is connected — nothing is estimated."}</p>
      </section>
    </div>
  );
}
