import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminOverview } from "@/lib/admin.functions";
import { planByKey, gbp } from "@/lib/plans";
import { Kpi } from "@/components/hv/AdminKpi";
import { DashboardCharts } from "@/components/hv/DashboardCharts";

export const Route = createFileRoute("/super-admin/")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(adminOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fn(),
  });
  if (isLoading) return <p className="text-muted-foreground">Loading platform figures…</p>;
  if (error || !data)
    return <p className="text-destructive">Couldn't load figures: {(error as Error)?.message}</p>;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">MatrixKeep Control Centre</h1>
        <p className="text-sm text-muted-foreground">Live figures from your platform.</p>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="All accounts"
          value={data.total}
          hint={`${data.new30} new in 30 days`}
          to="/super-admin/subscribers"
        />
        <Kpi
          label="Individual"
          value={data.byType["individual"] ?? 0}
          to="/super-admin/subscribers"
        />
        <Kpi label="Business" value={data.byType["business"] ?? 0} to="/super-admin/subscribers" />
        <Kpi
          label="Enterprise"
          value={data.byType["enterprise"] ?? 0}
          to="/super-admin/subscribers"
        />
        <Kpi label="Active trials" value={data.trials} />
        <Kpi
          label="Paying (card)"
          value={data.paid}
          hint={
            data.paid ? `${gbp(data.mrr)} monthly list value` : "Card payments not connected yet"
          }
        />
        <Kpi label="Suspended" value={data.suspended} />
        <Kpi
          label="Voucher redemptions"
          value={data.voucherRedemptions}
          hint={`${data.activeVouchers} active codes`}
          to="/super-admin/vouchers"
        />
        <Kpi label="Records saved" value={data.records} />
        <Kpi label="Evidence files" value={data.files} />
        <Kpi label="Extra workspaces" value={data.workspaces} />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Sign-ups, last 30 days</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <BarChart data={data.signups}>
                <XAxis dataKey="day" fontSize={10} interval={4} />
                <YAxis allowDecimals={false} fontSize={10} width={24} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold text-foreground">Accounts by plan</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(data.byPlan)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <li key={k} className="flex justify-between">
                  <span>{planByKey(k).name}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
          </ul>
        </section>
      </div>
      <DashboardCharts />
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent admin activity</h2>
          <Link to="/super-admin/audit" className="text-sm text-primary">
            View all
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No admin actions yet.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {data.recent.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <span>
                  {r.action.replace(/_/g, " ")} —{" "}
                  <span className="text-muted-foreground">{r.target}</span>
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Revenue, card payments, AI costs and hosting costs will appear here once card payments and
        cost tracking are connected.
      </p>
    </div>
  );
}
