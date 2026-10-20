import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { billingData, billingKinds, type BillingKind } from "@/lib/billing.functions";
import { Kpi, PageTitle, SetupRequired, money, when } from "@/components/hv/AdminKpi";
import { DataTable, useBillingRange, stripeSteps, billingTabs } from "@/components/hv/BillingKit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/super-admin/billing/$kind")({
  beforeLoad: ({ params }) => {
    if (!(billingKinds as readonly string[]).includes(params.kind) || params.kind === "overview")
      throw notFound();
  },
  component: BillingList,
});

function BillingList() {
  const { kind } = Route.useParams() as { kind: BillingKind };
  const title = billingTabs.find(([k]) => k === kind)?.[1] ?? kind;
  const fn = useServerFn(billingData);
  const { range, picker } = useBillingRange();
  const [open, setOpen] = useState<Awaited<ReturnType<typeof billingData>>["rows"][number] | null>(
    null,
  );
  const q = useQuery({
    queryKey: ["admin", "billing", kind, range],
    queryFn: () => fn({ data: { ...range, kind } }),
  });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageTitle
        title={title}
        sub="Live from Stripe. Changes such as refunds are made in Stripe so its records stay authoritative."
      >
        {picker}
      </PageTitle>
      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.error || !d ? (
        <p className="text-destructive">{(q.error as Error)?.message}</p>
      ) : !d.connected ? (
        <SetupRequired
          title={`${title} need Stripe`}
          needs={["STRIPE_SECRET_KEY"]}
          steps={stripeSteps}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Rows in period" value={d.rows.length} />
            <Kpi label="Total amount" value={money(d.rows.reduce((s, r) => s + r.amount, 0))} />
            {kind === "outstanding" && <Kpi label="Past due" value={money(d.kpis!.pastDue)} />}
            {kind === "stripe" && (
              <>
                <Kpi
                  label="Available balance"
                  value={
                    d.kpis!.available.map((b) => money(b.amount, b.currency)).join(" · ") || "—"
                  }
                />
                <Kpi
                  label="Pending balance"
                  value={d.kpis!.pending.map((b) => money(b.amount, b.currency)).join(" · ") || "—"}
                />
              </>
            )}
            {kind === "reconciliation" && d.recon && (
              <>
                <Kpi label="Card-billed in MatrixKeep" value={d.recon.dbPaid} />
                <Kpi label="Active in Stripe" value={d.recon.stripeActive} />
              </>
            )}
          </section>
          {kind === "reconciliation" && d.recon ? (
            <DataTable
              name="reconciliation"
              rows={d.recon.issues.map((x, i) => ({ id: String(i), ...x }))}
              cols={[
                { key: "issue", label: "Issue" },
                { key: "detail", label: "Detail" },
              ]}
              filters={[{ key: "issue", label: "Issues" }]}
            />
          ) : (
            <>
              {d.daily.length > 0 && (
                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-semibold">Per day</h2>
                  <div className="mt-4 h-48">
                    <ResponsiveContainer>
                      <BarChart data={d.daily}>
                        <XAxis dataKey="day" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Bar
                          dataKey={
                            kind === "invoices" || kind === "outstanding" ? "billed" : "collected"
                          }
                          fill="var(--primary)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
              <DataTable
                name={kind}
                rows={d.rows}
                onOpen={setOpen}
                filters={[
                  { key: "status", label: "Statuses" },
                  { key: "currency", label: "Currencies" },
                  ...(kind === "transactions" ? [{ key: "type", label: "Types" }] : []),
                ]}
                cols={[
                  { key: "created", label: "Date", render: (r) => when(r.created) },
                  { key: "type", label: "Type" },
                  {
                    key: "id",
                    label: "Reference",
                    render: (r) => <span className="font-mono text-xs">{r.id}</span>,
                  },
                  { key: "customer", label: "Customer" },
                  { key: "amount", label: "Amount", render: (r) => money(r.amount, r.currency) },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => <span className="capitalize">{r.status}</span>,
                  },
                ]}
              />
            </>
          )}
        </>
      )}
      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.id}</DialogTitle>
          </DialogHeader>
          {open && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(open)
                .filter(([k]) => k !== "pdf")
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="capitalize text-muted-foreground">{k}</dt>
                    <dd className="break-all">{String(v ?? "—")}</dd>
                  </div>
                ))}
            </dl>
          )}
          {open?.pdf && (
            <a
              href={open.pdf}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary"
            >
              Download invoice PDF
            </a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
