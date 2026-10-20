import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { billingData } from "@/lib/billing.functions";
import { Kpi, PageTitle, SetupRequired, money } from "@/components/hv/AdminKpi";
import { useBillingRange, stripeSteps } from "@/components/hv/BillingKit";

export const Route = createFileRoute("/super-admin/billing/")({ component: Overview });

const colors = [
  "var(--primary)",
  "var(--chart-2, #16a34a)",
  "var(--chart-3, #f59e0b)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

function Overview() {
  const fn = useServerFn(billingData);
  const { range, picker } = useBillingRange();
  const q = useQuery({
    queryKey: ["admin", "billing", "overview", range],
    queryFn: () => fn({ data: { ...range, kind: "overview" } }),
  });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Billing overview"
        sub="Card payments from Stripe; recurring revenue from card-billed accounts."
      >
        {picker}
      </PageTitle>
      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.error || !d ? (
        <p className="text-destructive">{(q.error as Error)?.message}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="MRR" value={money(d.local.mrr)} to="/super-admin/revenue" />
            <Kpi label="ARR" value={money(d.local.arr)} to="/super-admin/revenue" />
            <Kpi
              label="Active paid subscribers"
              value={d.local.activePaid}
              to="/super-admin/subscriptions"
            />
            {d.kpis && (
              <>
                <Kpi
                  label="Total billed"
                  value={money(d.kpis.billed)}
                  to="/super-admin/billing/invoices"
                />
                <Kpi
                  label="Total collected"
                  value={money(d.kpis.collected)}
                  to="/super-admin/billing/payments"
                />
                <Kpi
                  label="Outstanding"
                  value={money(d.kpis.outstanding)}
                  to="/super-admin/billing/outstanding"
                />
                <Kpi
                  label="Past due"
                  value={money(d.kpis.pastDue)}
                  to="/super-admin/billing/outstanding"
                />
                <Kpi
                  label="Invoices generated"
                  value={d.kpis.invoices}
                  to="/super-admin/billing/invoices"
                />
                <Kpi
                  label="Invoices paid"
                  value={d.kpis.invoicesPaid}
                  to="/super-admin/billing/invoices"
                />
                <Kpi
                  label="Invoices open"
                  value={d.kpis.invoicesOpen}
                  to="/super-admin/billing/outstanding"
                />
                <Kpi
                  label="Failed payments"
                  value={d.kpis.failed}
                  to="/super-admin/billing/failed"
                />
                <Kpi
                  label="Refunded"
                  value={money(d.kpis.refunded)}
                  to="/super-admin/billing/refunds"
                />
                <Kpi
                  label="Average invoice"
                  value={money(d.kpis.avgInvoice)}
                  to="/super-admin/billing/invoices"
                />
              </>
            )}
          </section>
          {!d.connected ? (
            <SetupRequired
              title="Connect Stripe to see invoices, payments and balances"
              needs={["STRIPE_SECRET_KEY"]}
              steps={stripeSteps}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Billed vs collected</h2>
                <div className="mt-4 h-56">
                  <ResponsiveContainer>
                    <BarChart data={d.daily}>
                      <XAxis dataKey="day" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="billed" fill={colors[0]} />
                      <Bar dataKey="collected" fill={colors[1]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Revenue trend</h2>
                <div className="mt-4 h-56">
                  <ResponsiveContainer>
                    <LineChart data={d.daily}>
                      <XAxis dataKey="day" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line dataKey="collected" stroke={colors[0]} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Invoice status</h2>
                <div className="mt-4 h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={d.statuses} dataKey="value" nameKey="name" outerRadius={80} label>
                        {d.statuses.map((_, i) => (
                          <Cell key={i} fill={colors[i % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
