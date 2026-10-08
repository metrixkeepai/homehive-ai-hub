import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { PlugZap } from "lucide-react";

export function Kpi({ label, value, hint, to, onClick }: { label: string; value: string | number; hint?: string | undefined; to?: string; onClick?: () => void }) {
  const body = (<><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</>);
  const cls = "block rounded-xl border bg-card p-4 text-left";
  if (to) return <Link to={to} className={`${cls} transition hover:border-primary`}>{body}</Link>;
  if (onClick) return <button onClick={onClick} className={`${cls} w-full transition hover:border-primary`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl text-foreground">{title}</h1>{sub && <p className="text-sm text-muted-foreground">{sub}</p>}</div>{children}</div>;
}

export function SetupRequired({ title, needs, steps }: { title: string; needs: string[]; steps: string[] }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6">
      <div className="flex items-center gap-2 text-primary"><PlugZap className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Setup required</span></div>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">No figures are shown until the provider is connected — nothing here is estimated.</p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="mt-4 text-xs text-muted-foreground">Needs: {needs.join(", ")}</p>
      <Link to="/super-admin/integrations" className="mt-4 inline-block text-sm font-medium text-primary">Open Integrations →</Link>
    </div>
  );
}

export function useRange(initial = 30) {
  const [days, setDays] = useState<number | "custom">(initial);
  const [from, setFrom] = useState(() => new Date(Date.now() - initial * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const range = useMemo(() => days === "custom"
    ? { from: new Date(from + "T00:00:00Z").toISOString(), to: new Date(to + "T23:59:59Z").toISOString() }
    : { from: new Date(new Date().setUTCHours(0, 0, 0, 0) - (days - 1) * 864e5).toISOString(), to: new Date(new Date().setUTCHours(23, 59, 59, 0)).toISOString() }, [days, from, to]);
  const picker = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {[7, 30, 90, 365].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1 ${days === d ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{d === 365 ? "12 months" : `${d} days`}</button>)}
      <button onClick={() => setDays("custom")} className={`rounded-full border px-3 py-1 ${days === "custom" ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>Custom</button>
      {days === "custom" && <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border bg-background px-2 py-1" aria-label="From" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border bg-background px-2 py-1" aria-label="To" /></>}
    </div>
  );
  return { range, picker };
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{head.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{children}{empty && <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">Nothing in this period yet.</td></tr>}</tbody>
      </table>
    </div>
  );
}

export const money = (n: number, c = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: n < 1 && n > 0 ? 4 : 2 }).format(n);
export const when = (s: string) => new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
