import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aiUsage, setAiRate } from "@/lib/admin-ops.functions";
import { planByKey } from "@/lib/plans";
import { Kpi, PageTitle, Table, money, useRange, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/super-admin/ai")({ component: AI });

function AI() {
  const fn = useServerFn(aiUsage),
    rateFn = useServerFn(setAiRate);
  const qc = useQueryClient();
  const { range, picker } = useRange(30);
  const [view, setView] = useState<"feature" | "customer" | "plan" | "model" | "calls">("feature");
  const q = useQuery({ queryKey: ["admin", "ai", range], queryFn: () => fn({ data: range }) });
  const [model, setModel] = useState("gpt-6-luna");
  const [inp, setInp] = useState(0);
  const [out, setOut] = useState(0);
  const m = useMutation({
    mutationFn: () => rateFn({ data: { model, input: inp, output: out } }),
    onSuccess: () => {
      toast.success("Rate saved");
      qc.invalidateQueries({ queryKey: ["admin", "ai"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">{(q.error as Error)?.message}</p>;
  const d = q.data;
  const rows =
    view === "feature"
      ? d.byFeature
      : view === "plan"
        ? d.byPlan.map((r) => ({ ...r, key: planByKey(r.key).name }))
        : view === "model"
          ? d.byModel
          : d.byCustomer;
  return (
    <div className="space-y-6">
      <PageTitle
        title="AI usage & cost"
        sub="Every Sera answer and Add anything capture is recorded with its tokens and timing."
      >
        {picker}
      </PageTitle>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="AI calls" value={d.calls} onClick={() => setView("calls")} />
        <Kpi
          label="Estimated cost"
          value={money(d.cost, "USD")}
          hint={d.rates.length ? "Tokens × your rates" : "Set model rates below"}
        />
        <Kpi
          label="Tokens in / out"
          value={`${d.inputTokens.toLocaleString()} / ${d.outputTokens.toLocaleString()}`}
        />
        <Kpi
          label="Errors"
          value={d.errors}
          hint={`Avg ${d.avgLatency} ms`}
          onClick={() => setView("calls")}
        />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Calls per day</h2>
        <div className="mt-4 h-52">
          <ResponsiveContainer>
            <BarChart data={d.byDay}>
              <XAxis dataKey="key" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={28} />
              <Tooltip />
              <Bar dataKey="calls" fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {(["feature", "customer", "plan", "model", "calls"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${view === v ? "bg-foreground text-background" : "border bg-card"}`}
          >
            By {v === "calls" ? "call" : v}
          </button>
        ))}
      </div>
      {view === "calls" ? (
        <Table
          head={["When", "Feature", "Model", "Tokens", "Latency", "Cost", "Result"]}
          empty={d.recent.length === 0}
        >
          {d.recent.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-3">{when(l.created_at)}</td>
              <td className="p-3">{l.feature}</td>
              <td className="p-3">{l.model}</td>
              <td className="p-3">{l.input_tokens + l.output_tokens}</td>
              <td className="p-3">{l.latency_ms} ms</td>
              <td className="p-3">{money(l.cost, "USD")}</td>
              <td className="p-3">
                {l.ok ? "OK" : <span className="text-destructive">{l.error}</span>}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table
          head={[view === "customer" ? "Customer" : view, "Calls", "Tokens", "Errors", "Cost"]}
          empty={rows.length === 0}
        >
          {rows.map((r) => (
            <tr key={r.key} className="border-t hover:bg-muted/30">
              <td className="p-3 capitalize">
                {view === "customer" && r.key !== "unknown" ? (
                  <Link
                    to="/super-admin/subscribers/$id"
                    params={{ id: r.key }}
                    className="hover:text-primary"
                  >
                    {"name" in r ? String(r.name) : r.key}
                  </Link>
                ) : (
                  r.key
                )}
              </td>
              <td className="p-3">{r.calls}</td>
              <td className="p-3">{r.tokens.toLocaleString()}</td>
              <td className="p-3">{r.errors}</td>
              <td className="p-3">{money(r.cost, "USD")}</td>
            </tr>
          ))}
        </Table>
      )}
      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold">Model rates (USD per million tokens)</h2>
        <p className="text-xs text-muted-foreground">
          Enter the rates from your AI provider's price list; costs are calculated from these.
        </p>
        <ul className="mt-3 space-y-1">
          {d.rates.map((r) => (
            <li key={r.model}>
              {r.model}: in ${r.input_per_million_usd} · out ${r.output_per_million_usd}
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-56"
            aria-label="Model"
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={inp}
            onChange={(e) => setInp(Number(e.target.value))}
            className="w-28"
            aria-label="Input rate"
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={out}
            onChange={(e) => setOut(Number(e.target.value))}
            className="w-28"
            aria-label="Output rate"
          />
          <Button type="submit" disabled={m.isPending}>
            Save rate
          </Button>
        </form>
      </section>
    </div>
  );
}
