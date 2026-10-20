import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiUsage } from "@/lib/admin-ops.functions";
import { Kpi, PageTitle, Table, useRange } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/api")({ component: Api });

function Api() {
  const fn = useServerFn(apiUsage);
  const { range, picker } = useRange(30);
  const q = useQuery({ queryKey: ["admin", "api", range], queryFn: () => fn({ data: range }) });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">{(q.error as Error)?.message}</p>;
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageTitle
        title="API & platform usage"
        sub="AI requests, records created and files uploaded across all accounts."
      >
        {picker}
      </PageTitle>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="AI requests"
          value={d.aiCalls}
          hint={`${d.aiErrors} failed`}
          to="/super-admin/ai"
        />
        <Kpi label="Records created" value={d.records} />
        <Kpi label="Files uploaded" value={d.uploads} />
        <Kpi label="Upload volume" value={`${(d.uploadBytes / 1048576).toFixed(1)} MB`} />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Daily activity</h2>
        <div className="mt-4 h-60">
          <ResponsiveContainer>
            <BarChart data={d.daily}>
              <XAxis dataKey="day" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={28} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ai" name="AI" fill="var(--primary)" />
              <Bar dataKey="records" name="Records" fill="var(--accent-foreground)" />
              <Bar dataKey="uploads" name="Uploads" fill="var(--muted-foreground)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <Table head={["Section", "Records created"]} empty={d.sections.length === 0}>
        {d.sections.map((s) => (
          <tr key={s.section} className="border-t">
            <td className="p-3 capitalize">{s.section}</td>
            <td className="p-3">{s.count}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-muted-foreground">
        Need per-request detail?{" "}
        <Link to="/super-admin/ai" className="text-primary">
          Open AI usage
        </Link>
        .
      </p>
    </div>
  );
}
