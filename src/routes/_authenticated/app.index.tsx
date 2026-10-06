import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Wrench, ShieldCheck, Package, Sparkles, Check, Send } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Home — HomeVault AI" },
      { name: "description", content: "Your home at a glance: health, AI team activity and what needs you today." },
      { property: "og:title", content: "Home — HomeVault AI" },
      { property: "og:description", content: "Your AI household team has checked everything." },
    ],
  }),
  component: Dashboard,
});

const agentStatus = [
  { n: "Document Agent", s: "Matched 3 receipts from Gmail", i: FileText, id: "document-agent" },
  { n: "Warranty Agent", s: "Checking 14 active warranties", i: ShieldCheck, id: "warranty-agent" },
  { n: "Maintenance Agent", s: "Planning autumn checklist", i: Wrench, id: "maintenance-agent" },
  { n: "Asset Agent", s: "Valuing 2 new kitchen items", i: Package, id: "asset-agent" },
];

const initialToday = [
  { id: 1, t: "Boiler service due in 21 days", d: "Last serviced Oct 2025 by HeatRight. Book now to keep your warranty valid.", a: "Book service", tone: "warning", sec: "maintenance", item: "boiler-service" },
  { id: 2, t: "TV warranty expires soon", d: "Samsung QLED 65\u201d \u2014 cover ends in 26 days. Extend or report an issue first.", a: "Review options", tone: "primary", sec: "warranties", item: "w-samsung" },
  { id: 3, t: "Three receipts matched", d: "Dyson V15, Sage Barista, Philips Hue kit linked to their passports.", a: "Confirm", tone: "success", sec: "documents", item: "" },
];

const value = [
  { n: "Electronics", v: 8400 }, { n: "Furniture", v: 12600 }, { n: "Appliances", v: 6200 }, { n: "Jewellery", v: 4300 }, { n: "Other", v: 2900 },
];
const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const [today, setToday] = useState(initialToday);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setAnswer(`Demo answer: I found 2 records related to \u201c${q}\u201d. Your Samsung TV receipt (Currys, Mar 2024) and its warranty certificate are in Documents.`);
    setQ("");
  };

  return (
    <>
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Demo household · sample data</span>

          {/* Home Pulse */}
          <section className="grid gap-6 overflow-hidden rounded-[2rem] bg-midnight-glow p-8 text-midnight-foreground md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <p className="text-sm text-midnight-foreground/60">Good evening{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}</p>
              <h1 className="mt-2 font-display text-4xl font-medium leading-tight md:text-5xl">
                Your AI team checked everything.<br /><span className="text-aurora">Just {today.length} things need you.</span>
              </h1>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 text-sm">
                {[["248", "Items", "assets"], ["£34.4k", "Insured value", "insurance"], ["92%", "Documented", "my-home"]].map(([v, l, sec]) => (
                  <Link to="/app/$section" params={{ section: sec ?? "" }} key={l} className="hover:opacity-80"><p className="font-display text-2xl">{v}</p><p className="text-midnight-foreground/60">{l}</p></Link>
                ))}
              </div>
            </div>
            <div className="relative grid h-44 w-44 place-items-center self-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="8" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--aurora)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${0.86 * 276} 276`} />
              </svg>
              <div className="text-center"><p className="font-display text-4xl">86</p><p className="text-xs text-midnight-foreground/60">Home Health</p></div>
            </div>
          </section>

          {/* AI team */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-success animate-pulse-ring" /><span className="h-2 w-2 rounded-full bg-success" /></span>
              Your AI team is working
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {agentStatus.map((a) => (
                <Link key={a.n} to="/app/$section/$id" params={{ section: "agents", id: a.id }} className="rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary">
                  <a.i className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-semibold">{a.n}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.s}</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 animate-pulse rounded-full bg-aurora" /></div>
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
                    <p className="mt-3 font-semibold">All clear</p>
                    <p className="text-sm text-muted-foreground">Your agents will let you know when something needs you.</p>
                  </div>
                )}
                {today.map((t) => (
                  <div key={t.id} className="animate-rise flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center">
                    <span className={`h-10 w-1 shrink-0 rounded-full ${t.tone === "warning" ? "bg-warning" : t.tone === "success" ? "bg-success" : "bg-primary"}`} />
                    <div className="flex-1">
                      <p className="font-semibold">{t.t}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t.d}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {t.item ? <Link to="/app/$section/$id" params={{ section: t.sec, id: t.item }} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">{t.a}</Link>
                        : <Link to="/app/$section" params={{ section: t.sec }} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">{t.a}</Link>}
                      <button onClick={() => setToday((x) => x.filter((y) => y.id !== t.id))} className="rounded-full border px-3 py-2 text-sm">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Chart */}
            <section className="rounded-3xl border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between"><h2 className="font-display text-2xl">Asset value</h2><Link to="/app/$section" params={{ section: "assets" }} className="text-sm text-primary">View assets →</Link></div>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={value} dataKey="v" nameKey="n" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {value.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-sm">
                {value.map((v, i) => (
                  <li key={v.n} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} /><span className="flex-1 text-muted-foreground">{v.n}</span>£{v.v.toLocaleString()}</li>
                ))}
              </ul>
            </section>
          </div>

          {/* Ask */}
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="h-5 w-5 text-violet" /> Ask HomeVault</h2>
            <form onSubmit={ask} className="mt-4 flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where's the receipt for the TV?" className="flex-1 rounded-full border bg-background px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button className="grid h-11 w-11 place-items-center rounded-full bg-aurora text-primary-foreground"><Send className="h-4 w-4" /></button>
            </form>
            {answer && <p className="animate-rise mt-4 rounded-2xl bg-secondary p-4 text-sm">{answer}</p>}
          </section>
        </div>
    </>
  );
}
