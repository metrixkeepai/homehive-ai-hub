import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { paymentsData } from "@/lib/admin-ops.functions";
import { Kpi, PageTitle, SetupRequired, Table, money, useRange, when } from "@/components/hv/AdminKpi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/super-admin/payments")({ component: Payments });

const tabs = [["overview", "Balance"], ["payments", "Payments"], ["invoices", "Invoices"], ["outstanding", "Outstanding"], ["refunds", "Refunds"], ["subscriptions", "Subscriptions"]] as const;

function Payments() {
  const fn = useServerFn(paymentsData);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const [open, setOpen] = useState<any>(null);
  const { range, picker } = useRange(30);
  const q = useQuery({ queryKey: ["admin", "pay", tab, range], queryFn: () => fn({ data: { ...range, kind: tab } }) });
  const d: any = q.data;
  return (
    <div className="space-y-6">
      <PageTitle title="Stripe control centre" sub="Live from Stripe when connected.">{picker}</PageTitle>
      <div className="flex flex-wrap gap-2">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? "bg-foreground text-background" : "bg-card border"}`}>{l}</button>)}</div>
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : q.error ? <p className="text-destructive">{(q.error as Error).message}</p> : !d?.connected ? (
        <SetupRequired title="Stripe isn't connected yet" needs={["STRIPE_SECRET_KEY"]} steps={["Ask Lovable in chat: “Connect Stripe payments for MatrixKeep”.", "Approve the connection and enter your Stripe secret key in the secure form.", "Balances, payments, invoices, outstanding amounts and refunds then load here live."]} />
      ) : tab === "overview" ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Available balance" value={d.available.map((b: any) => money(b.amount, b.currency)).join(" · ") || "—"} />
          <Kpi label="Pending balance" value={d.pending.map((b: any) => money(b.amount, b.currency)).join(" · ") || "—"} />
          <Kpi label="Collected in period" value={money(d.gross)} onClick={() => setTab("payments")} />
          <Kpi label="Refunded in period" value={money(d.refunded)} onClick={() => setTab("refunds")} />
          <Kpi label="Failed payments" value={d.failed} onClick={() => setTab("payments")} />
          <Kpi label="Outstanding" value={money(d.outstanding)} hint={`${d.outstandingCount} open invoices`} onClick={() => setTab("outstanding")} />
        </section>
      ) : (
        <Table head={["Date", "Reference", "Customer", "Amount", "Status"]} empty={d.rows.length === 0}>
          {d.rows.map((r: any) => <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-t hover:bg-muted/30"><td className="p-3">{when(r.created)}</td><td className="p-3 font-mono text-xs">{r.id}</td><td className="p-3">{r.customer}</td><td className="p-3">{money(r.amount, r.currency)}</td><td className="p-3 capitalize">{r.status}</td></tr>)}
        </Table>
      )}
      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent><DialogHeader><DialogTitle>{open?.id}</DialogTitle></DialogHeader>
          {open && <dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(open).map(([k, v]) => <div key={k} className="contents"><dt className="capitalize text-muted-foreground">{k}</dt><dd className="break-all">{String(v)}</dd></div>)}</dl>}
          <p className="text-xs text-muted-foreground">Refunds and invoice changes are made in Stripe so its records stay authoritative.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
