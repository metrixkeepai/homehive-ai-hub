import { useMemo, useState, type ReactNode } from "react";
import { toCsv } from "@/lib/reports";

const day = 864e5;
const sod = (d: Date) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
export const presets = ["Today", "Yesterday", "7 Days", "30 Days", "This Month", "Last Month", "Quarter", "Year", "All Time", "Custom"] as const;

export function presetRange(p: (typeof presets)[number], now = new Date()) {
  const t = sod(now), end = new Date(t.getTime() + day - 1000);
  const y = t.getUTCFullYear(), m = t.getUTCMonth();
  switch (p) {
    case "Today": return { from: t, to: end };
    case "Yesterday": return { from: new Date(t.getTime() - day), to: new Date(t.getTime() - 1000) };
    case "7 Days": return { from: new Date(t.getTime() - 6 * day), to: end };
    case "30 Days": return { from: new Date(t.getTime() - 29 * day), to: end };
    case "This Month": return { from: new Date(Date.UTC(y, m, 1)), to: end };
    case "Last Month": return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1) - 1000) };
    case "Quarter": return { from: new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)), to: end };
    case "Year": return { from: new Date(Date.UTC(y, 0, 1)), to: end };
    default: return { from: new Date(Date.UTC(2020, 0, 1)), to: end };
  }
}

export function useBillingRange(initial: (typeof presets)[number] = "30 Days") {
  const [p, setP] = useState<(typeof presets)[number]>(initial);
  const [cf, setCf] = useState(() => new Date(Date.now() - 30 * day).toISOString().slice(0, 10));
  const [ct, setCt] = useState(() => new Date().toISOString().slice(0, 10));
  const range = useMemo(() => {
    if (p === "Custom") return { from: new Date(cf + "T00:00:00Z").toISOString(), to: new Date(ct + "T23:59:59Z").toISOString() };
    const r = presetRange(p);
    return { from: r.from.toISOString(), to: r.to.toISOString() };
  }, [p, cf, ct]);
  const picker = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select aria-label="Date range" value={p} onChange={(e) => setP(e.target.value as typeof p)} className="rounded-md border bg-background px-2 py-1">{presets.map((x) => <option key={x}>{x}</option>)}</select>
      {p === "Custom" && <><input type="date" aria-label="From" value={cf} onChange={(e) => setCf(e.target.value)} className="rounded-md border bg-background px-2 py-1" /><input type="date" aria-label="To" value={ct} onChange={(e) => setCt(e.target.value)} className="rounded-md border bg-background px-2 py-1" /></>}
    </div>
  );
  return { range, picker, preset: p };
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows as any)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

/** Search + filter + paging + rows-per-page + export over an in-memory list. */
export function DataTable<T extends Record<string, any>>({ rows, cols, name, onOpen, filters }: {
  rows: T[]; name: string; onOpen?: (r: T) => void;
  cols: { key: string; label: string; render?: (r: T) => ReactNode }[];
  filters?: { key: string; label: string }[];
}) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [per, setPer] = useState(25);
  const [f, setF] = useState<Record<string, string>>({});
  const list = rows.filter((r) => (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) && Object.entries(f).every(([k, v]) => !v || String(r[k]) === v));
  const pages = Math.max(1, Math.ceil(list.length / per)), cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * per, cur * per);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search…" aria-label="Search" className="rounded-md border bg-background px-3 py-1.5" />
        {filters?.map((fl) => <select key={fl.key} aria-label={fl.label} value={f[fl.key] ?? ""} onChange={(e) => { setF({ ...f, [fl.key]: e.target.value }); setPage(1); }} className="rounded-md border bg-background px-2 py-1.5"><option value="">All {fl.label.toLowerCase()}</option>{[...new Set(rows.map((r) => String(r[fl.key])))].filter(Boolean).map((v) => <option key={v}>{v}</option>)}</select>)}
        <button onClick={() => downloadCsv(name, list)} disabled={!list.length} className="ml-auto rounded-md border bg-card px-3 py-1.5 disabled:opacity-50">Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{cols.map((c) => <th key={c.key} className="p-3 font-medium">{c.label}</th>)}</tr></thead>
          <tbody>
            {shown.map((r, i) => <tr key={r.id ?? i} onClick={onOpen ? () => onOpen(r) : undefined} className={`border-t ${onOpen ? "cursor-pointer hover:bg-muted/30" : ""}`}>{cols.map((c) => <td key={c.key} className="p-3">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}</tr>)}
            {!shown.length && <tr><td colSpan={cols.length} className="p-6 text-center text-muted-foreground">Nothing matches yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Showing {list.length ? (cur - 1) * per + 1 : 0}–{Math.min(cur * per, list.length)} of {list.length}</span>
        <select aria-label="Rows per page" value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }} className="rounded-md border bg-background px-2 py-1">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}</select>
        <div className="ml-auto flex gap-2">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-md border bg-card px-3 py-1 disabled:opacity-50">Previous</button>
          <span>Page {cur} of {pages}</span>
          <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-md border bg-card px-3 py-1 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}

export const bytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`;
