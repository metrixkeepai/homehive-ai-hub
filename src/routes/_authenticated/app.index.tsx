import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Wrench, ShieldCheck, Package, Sparkles, Check, Send } from "lucide-react";
import { useStore } from "@/components/hv/store";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Home — MatrixKeep AI" },
      {
        name: "description",
        content: "Your home at a glance: health, AI team activity and what needs you today.",
      },
      { property: "og:title", content: "Home — MatrixKeep AI" },
      { property: "og:description", content: "Your saved records and tasks in MatrixKeep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const agentStatus = [
  { n: "Documents", s: "Review your saved evidence", i: FileText, id: "documents" },
  { n: "Warranties", s: "Track dates you have recorded", i: ShieldCheck, id: "warranties" },
  { n: "Maintenance", s: "Manage your saved maintenance records", i: Wrench, id: "maintenance" },
  { n: "Assets", s: "Browse your inventory", i: Package, id: "assets" },
];
const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const { profile, added, current } = useStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const today = (added["tasks"] ?? [])
    .filter((item) => !dismissed.includes(item.id))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      t: item.title,
      d: item.subtitle,
      a: "View task",
      tone: "primary",
      sec: "tasks",
      item: item.id,
    }));
  const value = ["assets", "documents", "warranties", "renewals", "maintenance"]
    .map((key) => ({ n: key, v: added[key]?.length ?? 0 }))
    .filter((row) => row.v > 0);
  const count = Object.values(added).reduce((sum, items) => sum + items.length, 0);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          {current.name} · your saved records
        </span>

        {/* Home Pulse */}
        <section className="grid gap-6 overflow-hidden rounded-[2rem] bg-midnight-glow p-8 text-midnight-foreground md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <p className="text-sm text-midnight-foreground/60">
              Welcome{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight md:text-5xl">
              Your workspace at a glance.
              <br />
              <span className="text-aurora">{today.length} saved tasks to review.</span>
            </h1>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 text-sm">
              {[
                [String(added["assets"]?.length ?? 0), "Items", "assets"],
                [String(added["documents"]?.length ?? 0), "Documents", "documents"],
                [String(added["warranties"]?.length ?? 0), "Warranties", "warranties"],
              ].map(([v, l, sec]) => (
                <Link
                  to="/app/$section"
                  params={{ section: sec ?? "" }}
                  key={l}
                  className="hover:opacity-80"
                >
                  <p className="font-display text-2xl">{v}</p>
                  <p className="text-midnight-foreground/60">{l}</p>
                </Link>
              ))}
            </div>
          </div>
          <div className="relative grid h-44 w-44 place-items-center self-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="var(--aurora)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="276 276"
              />
            </svg>
            <div className="text-center">
              <p className="font-display text-4xl">{count}</p>
              <p className="text-xs text-midnight-foreground/60">Saved records</p>
            </div>
          </div>
        </section>

        {/* AI team */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-success animate-pulse-ring" />
              <span className="h-2 w-2 rounded-full bg-success" />
            </span>
            Your tools
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agentStatus.map((a) => (
              <Link
                key={a.n}
                to="/app/$section"
                params={{ section: a.id }}
                className="rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary"
              >
                <a.i className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">{a.n}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.s}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-aurora" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Today */}
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="font-display text-2xl">Today for you</h2>
            <div className="mt-5 space-y-3">
              {today.length === 0 && (
                <div className="rounded-2xl bg-secondary p-8 text-center">
                  <Check className="mx-auto h-8 w-8 text-success" />
                  <p className="mt-3 font-semibold">No saved tasks</p>
                  <p className="text-sm text-muted-foreground">
                    Add your own tasks to see them here.
                  </p>
                </div>
              )}
              {today.map((t) => (
                <div
                  key={t.id}
                  className="animate-rise flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
                >
                  <span
                    className={`h-10 w-1 shrink-0 rounded-full ${t.tone === "warning" ? "bg-warning" : t.tone === "success" ? "bg-success" : "bg-primary"}`}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{t.t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.d}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.item ? (
                      <Link
                        to="/app/$section/$id"
                        params={{ section: t.sec, id: t.item }}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        {t.a}
                      </Link>
                    ) : (
                      <Link
                        to="/app/$section"
                        params={{ section: t.sec }}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        {t.a}
                      </Link>
                    )}
                    <button
                      onClick={() => setDismissed((x) => [...x, t.id])}
                      className="rounded-full border px-3 py-2 text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Chart */}
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Saved record types</h2>
              <Link
                to="/app/$section"
                params={{ section: "assets" }}
                className="text-sm text-primary"
              >
                View assets →
              </Link>
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={value}
                    dataKey="v"
                    nameKey="n"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {value.map((_, i) => (
                      <Cell key={i} fill={colors[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} records`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {value.map((v, i) => (
                <li key={v.n} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />
                  <span className="flex-1 text-muted-foreground">{v.n}</span>
                  {v.v.toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
