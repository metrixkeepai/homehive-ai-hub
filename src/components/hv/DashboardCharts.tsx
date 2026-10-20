import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
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
import { dashboardCharts } from "@/lib/dashboard.functions";

const colors = [
  "var(--primary)",
  "#16a34a",
  "#f59e0b",
  "var(--destructive)",
  "var(--muted-foreground)",
];

export function DashboardCharts() {
  const fn = useServerFn(dashboardCharts);
  const q = useQuery({ queryKey: ["admin", "dash-charts"], queryFn: () => fn() });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading charts…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Couldn't load charts.</p>;
  const d = q.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-semibold">Platform activity, last 30 days</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <LineChart data={d.daily}>
                <XAxis dataKey="day" fontSize={10} interval={4} />
                <YAxis allowDecimals={false} fontSize={10} width={28} />
                <Tooltip />
                <Legend />
                <Line dataKey="records" name="Records added" stroke={colors[0]} dot={false} />
                <Line dataKey="uploads" name="Files uploaded" stroke={colors[1]} dot={false} />
                <Line dataKey="ai" name="AI requests" stroke={colors[2]} dot={false} />
                <Line
                  dataKey="vouchers"
                  name="Voucher redemptions"
                  stroke={colors[3]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">How accounts got their plan</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={d.sources}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  label={(e) => e.name}
                >
                  {d.sources.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Sign-up growth (cumulative, 30 days)</h2>
        <div className="mt-4 h-44">
          <ResponsiveContainer>
            <AreaChart
              data={d.daily.reduce<{ day: string; total: number }[]>(
                (a, x) => [...a, { day: x.day, total: (a.at(-1)?.total ?? 0) + x.signups }],
                [],
              )}
            >
              <XAxis dataKey="day" fontSize={10} interval={4} />
              <YAxis allowDecimals={false} fontSize={10} width={28} />
              <Tooltip />
              <Area dataKey="total" stroke={colors[0]} fill={colors[0]} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Ending in the next 7 days</h2>
          {d.ending.length ? (
            <ul className="mt-3 divide-y">
              {d.ending.map((x) => (
                <li key={x.id + x.what} className="flex justify-between py-2">
                  <Link
                    to="/super-admin/subscribers/$id"
                    params={{ id: x.id }}
                    className="text-primary"
                  >
                    {x.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {x.what} · {new Date(x.ends).toLocaleDateString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">
              No trials or voucher benefits ending this week.
            </p>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">Accounts near storage limit</h2>
          {d.nearLimit.length ? (
            <ul className="mt-3 divide-y">
              {d.nearLimit.map((x) => (
                <li key={x.id} className="flex justify-between py-2">
                  <Link
                    to="/super-admin/subscribers/$id"
                    params={{ id: x.id }}
                    className="text-primary"
                  >
                    {x.name}
                  </Link>
                  <span className={x.pct >= 100 ? "text-destructive" : "text-muted-foreground"}>
                    {x.pct}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No account is above 75% of its storage.</p>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <div className="flex justify-between">
            <h2 className="font-semibold">Platform health</h2>
            <Link to="/super-admin/health" className="text-primary">
              Open
            </Link>
          </div>
          {d.health.length ? (
            <ul className="mt-3 divide-y">
              {d.health.map((h) => (
                <li key={h.service} className="flex justify-between py-2 capitalize">
                  <span>{h.service}</span>
                  <span className={h.ok ? "text-primary" : "text-destructive"}>
                    {h.ok ? "Healthy" : "Failing"}
                    {h.latency_ms != null && ` · ${h.latency_ms} ms`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No checks run yet.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            AI request failure rate (30 days): {d.aiFailRate}%
          </p>
        </section>
      </div>
    </div>
  );
}
