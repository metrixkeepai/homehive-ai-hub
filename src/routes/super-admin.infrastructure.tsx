import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { infraCosts, addInfraCost, deleteInfraCost } from "@/lib/admin-ops.functions";
import { Kpi, PageTitle, Table, money } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/super-admin/infrastructure")({ component: Infra });

function Infra() {
  const qc = useQueryClient();
  const list = useServerFn(infraCosts), add = useServerFn(addInfraCost), del = useServerFn(deleteInfraCost);
  const q = useQuery({ queryKey: ["admin", "infra"], queryFn: () => list() });
  const [f, setF] = useState({ provider: "Lovable Cloud", category: "hosting", description: "", amount: 0, currency: "GBP" as "GBP" | "USD" | "EUR", period_month: new Date().toISOString().slice(0, 7) });
  const [filter, setFilter] = useState("all");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "infra"] });
  const addM = useMutation({ mutationFn: () => add({ data: f }), onSuccess: () => { toast.success("Cost added"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: refresh });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const rows = (q.data?.rows ?? []) as any[];
  const shown = rows.filter((r) => filter === "all" || r.provider === filter);
  const months: Record<string, number> = {};
  shown.forEach((r) => { const k = r.period_month.slice(0, 7); months[k] = (months[k] ?? 0) + Number(r.amount); });
  const series = Object.entries(months).sort().map(([month, amount]) => ({ month, amount }));
  const last3 = series.slice(-3);
  const forecast = last3.length ? last3.reduce((s, x) => s + x.amount, 0) / last3.length : 0;
  const thisMonth = months[new Date().toISOString().slice(0, 7)] ?? 0;
  const providers = [...new Set(rows.map((r) => r.provider))];
  return (
    <div className="space-y-6">
      <PageTitle title="Infrastructure costs" sub="Hosting, cloud and tooling spend. Connected providers sync automatically; others are entered from invoices." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="This month" value={money(thisMonth)} />
        <Kpi label="Next month forecast" value={money(forecast)} hint="Average of the last 3 recorded months" />
        <Kpi label="All recorded" value={money(shown.reduce((s, r) => s + Number(r.amount), 0))} />
        <Kpi label="Entries" value={shown.length} />
      </section>
      <section className="grid gap-3 md:grid-cols-3">{q.data!.providers.map((p) => <div key={p.key} className="rounded-xl border bg-card p-4 text-sm"><p className="font-medium">{p.name}</p><p className={p.connected ? "text-primary" : "text-muted-foreground"}>{p.connected ? "Connected" : "Setup required"}</p><p className="mt-1 text-xs text-muted-foreground">{p.needs}</p></div>)}</section>
      {series.length > 0 && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Monthly spend</h2><div className="mt-4 h-52"><ResponsiveContainer><BarChart data={series}><XAxis dataKey="month" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="amount" fill="var(--primary)" /></BarChart></ResponsiveContainer></div></section>}
      <form onSubmit={(e) => { e.preventDefault(); addM.mutate(); }} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-5 text-sm">
        <label>Provider<Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} className="w-40" /></label>
        <label>Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="block h-9 rounded-md border bg-background px-2">{["hosting", "database", "storage", "ai", "email", "monitoring", "tooling", "other"].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Description<Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-48" /></label>
        <label>Amount<Input type="number" step="0.01" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} className="w-28" /></label>
        <label>Currency<select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as any })} className="block h-9 rounded-md border bg-background px-2"><option>GBP</option><option>USD</option><option>EUR</option></select></label>
        <label>Month<Input type="month" value={f.period_month} onChange={(e) => setF({ ...f, period_month: e.target.value })} /></label>
        <Button type="submit" disabled={addM.isPending || !f.provider}>Add cost</Button>
      </form>
      <div className="flex flex-wrap gap-2">{["all", ...providers].map((p) => <button key={p} onClick={() => setFilter(p)} className={`rounded-full border px-3 py-1 text-sm ${filter === p ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{p === "all" ? "All providers" : p}</button>)}</div>
      <Table head={["Month", "Provider", "Category", "Description", "Amount", "Source", ""]} empty={shown.length === 0}>
        {shown.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.period_month.slice(0, 7)}</td><td className="p-3">{r.provider}</td><td className="p-3">{r.category}</td><td className="p-3">{r.description}</td><td className="p-3">{money(Number(r.amount), r.currency)}</td><td className="p-3">{r.source}</td><td className="p-3"><button onClick={() => delM.mutate(r.id)} className="text-xs text-destructive">Remove</button></td></tr>)}
      </Table>
    </div>
  );
}
