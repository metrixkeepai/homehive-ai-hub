import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { runHealthChecks, healthHistory } from "@/lib/admin-ops.functions";
import { Kpi, PageTitle, Table, useRange, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super-admin/health")({ component: Health });

const label: Record<string, string> = {
  database: "Database",
  auth: "Sign-in service",
  storage: "File storage",
  lovable_ai: "AI gateway",
  stripe: "Stripe",
};

function Health() {
  const qc = useQueryClient();
  const run = useServerFn(runHealthChecks),
    hist = useServerFn(healthHistory);
  const { range, picker } = useRange(7);
  const [svc, setSvc] = useState("all");
  const h = useQuery({
    queryKey: ["admin", "health", range],
    queryFn: () => hist({ data: range }),
  });
  const r = useMutation({
    mutationFn: () => run(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "health"] }),
  });
  const live = r.data;
  const history = (h.data?.history ?? []).filter((x) => svc === "all" || x.service === svc);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Platform health"
        sub="Live checks against each service. Each run is saved so uptime builds up over time."
      >
        {picker}
        <Button onClick={() => r.mutate()} disabled={r.isPending}>
          {r.isPending ? "Checking…" : "Run checks now"}
        </Button>
      </PageTitle>
      {live && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {live.map((s) => (
            <Kpi
              key={s.service}
              label={label[s.service] ?? s.service}
              value={s.ok ? "Healthy" : "Down"}
              hint={`${s.ms} ms · ${s.detail}`}
            />
          ))}
        </section>
      )}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(h.data?.services ?? []).map((s) => (
          <Kpi
            key={s.service}
            label={`${label[s.service] ?? s.service} uptime`}
            value={`${((s.ok / s.checks) * 100).toFixed(1)}%`}
            hint={`${s.checks} checks · avg ${s.avgMs} ms`}
            onClick={() => setSvc(s.service)}
          />
        ))}
        <Kpi
          label="AI error rate"
          value={`${((h.data?.aiErrorRate ?? 0) * 100).toFixed(1)}%`}
          hint={`${h.data?.aiCalls ?? 0} AI calls`}
        />
      </section>
      {(h.data?.services ?? []).length === 0 && !live && (
        <p className="text-sm text-muted-foreground">
          No checks in this period yet — press “Run checks now”.
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        {["all", ...Object.keys(label)].map((s) => (
          <button
            key={s}
            onClick={() => setSvc(s)}
            className={`rounded-full border px-3 py-1 ${svc === s ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {s === "all" ? "All services" : label[s]}
          </button>
        ))}
      </div>
      <Table head={["When", "Service", "Result", "Latency", "Detail"]} empty={history.length === 0}>
        {history.map((x) => (
          <tr key={x.id} className="border-t">
            <td className="p-3">{when(x.created_at)}</td>
            <td className="p-3">{label[x.service] ?? x.service}</td>
            <td className="p-3">
              {x.ok ? "Healthy" : <span className="text-destructive">Down</span>}
            </td>
            <td className="p-3">{x.latency_ms} ms</td>
            <td className="p-3 text-muted-foreground">{x.detail}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
