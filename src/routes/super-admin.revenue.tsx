import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { revenueData, paymentsData } from "@/lib/admin-ops.functions";
import { Kpi, PageTitle, SetupRequired, Table, money, useRange } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/revenue")({ component: Revenue });

function Revenue() {
  const rev = useServerFn(revenueData), pay = useServerFn(paymentsData);
  const { range, picker } = useRange(30);
  const r = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => rev() });
  const p = useQuery({ queryKey: ["admin", "pay", "overview", range], queryFn: () => pay({ data: { ...range, kind: "overview" } }), enabled: !!r.data?.stripeConnected });
  if (r.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (r.error || !r.data) return <p className="text-destructive">{(r.error as Error)?.message}</p>;
  const d = r.data;
  const o = p.data && p.data.connected ? (p.data as any) : null;
  return (
    <div className="space-y-6">
      <PageTitle title="Revenue intelligence" sub="Recurring revenue counts only accounts billed by card. Voucher, trial and admin-granted plans are shown separately.">{d.stripeConnected && picker}</PageTitle>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Monthly recurring revenue" value={money(d.mrr)} hint="From card-billed accounts at list price" />
        <Kpi label="Annual run rate" value={money(d.arr)} />
        <Kpi label="Card-billed accounts" value={d.billedAccounts} to="/super-admin/subscriptions" />
        <Kpi label="Collected in period" value={o ? money(o.gross) : "—"} hint={o ? undefined : "Needs Stripe"} to="/super-admin/payments" />
      </section>
      {!d.stripeConnected && <SetupRequired title="Connect Stripe to see collected revenue, refunds and balances" needs={["STRIPE_SECRET_KEY"]} steps={["Ask Lovable in chat: “Connect Stripe payments for MatrixKeep”.", "Approve the Stripe connection when asked and add your secret key in the secure form.", "Return here — collected revenue, balances, invoices and refunds appear automatically."]} />}
      {o && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Collected per day</h2><div className="mt-4 h-56"><ResponsiveContainer><BarChart data={o.daily}><XAxis dataKey="day" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="amount" fill="var(--primary)" /></BarChart></ResponsiveContainer></div></section>}
      <Table head={["Plan", "Audience", "List price", "Accounts", "Card-billed", "Free / voucher / trial", "MRR"]}>
        {d.rows.map((x) => <tr key={x.key} className="border-t hover:bg-muted/30"><td className="p-3"><Link to="/super-admin/plans/$key" params={{ key: x.key }} className="font-medium hover:text-primary">{x.name}</Link></td><td className="p-3 capitalize">{x.audience}</td><td className="p-3">{x.monthly === null ? "Custom" : money(x.monthly)}</td><td className="p-3">{x.accounts}</td><td className="p-3">{x.billed}</td><td className="p-3">{x.free}</td><td className="p-3">{money(x.mrr)}</td></tr>)}
      </Table>
    </div>
  );
}
