import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageTitle, SetupRequired, Table, useRange } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findReport, toCsv } from "@/lib/reports";
import { runReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/super-admin/reports/$key")({
  loader: ({ params }) => { const r = findReport(params.key); if (!r) throw notFound(); return r; },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Report"} — MatrixKeep Control Centre` }, { name: "robots", content: "noindex" }] }),
  component: ReportPage,
});

const PER = 25;

function ReportPage() {
  const def = Route.useLoaderData();
  const run = useServerFn(runReport);
  const { range, picker } = useRange(30);
  const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const { data, isLoading, error } = useQuery({ queryKey: ["report", def.key, range], queryFn: () => run({ data: { key: def.key, ...range } }), enabled: !def.needs });
  const rows = useMemo(() => (data ?? []).filter((r: any) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [data, q]);
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const link = (r: any) => r.id && r.account_type ? <Link to="/super-admin/subscribers/$id" params={{ id: r.id }} className="text-primary">Open</Link> : null;

  function download() {
    const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `matrixkeep-${def.key}-${range.from.slice(0, 10)}-to-${range.to.slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="space-y-5">
      <Link to="/super-admin/reports" className="text-sm text-muted-foreground">← All reports</Link>
      <PageTitle title={def.title} sub={def.desc}>
        {!def.needs && <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={download} disabled={!rows.length}>Download for Excel</Button><Button variant="outline" onClick={() => window.print()} disabled={!rows.length}>Print / PDF</Button></div>}
      </PageTitle>
      {def.needs ? <SetupRequired title={`${def.title} need ${def.needs.join(", ")}`} needs={def.needs} steps={["Connect card payments", "Add the provider's secret key", "Figures load here automatically"]} /> : <>
        <div className="flex flex-wrap items-center gap-3 print:hidden">{picker}<Input placeholder="Filter rows…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="max-w-xs" /></div>
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : `${rows.length} rows`}</p>
        <Table head={cols.length ? [...cols.map((c) => c.replace(/_/g, " ")), ""] : ["Result"]} empty={!isLoading && !rows.length}>
          {rows.slice(page * PER, page * PER + PER).map((r: any, i: number) => (
            <tr key={i} className="border-t">{cols.map((c) => <td key={c} className="p-3 align-top">{r[c] == null ? "—" : typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}</td>)}<td className="p-3">{link(r)}</td></tr>
          ))}
        </Table>
        {pages > 1 && <div className="flex items-center gap-3 text-sm print:hidden"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>Page {page + 1} of {pages}<Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
      </>}
    </div>
  );
}
