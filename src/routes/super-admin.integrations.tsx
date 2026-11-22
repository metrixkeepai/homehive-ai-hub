import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { connectorOperations, listIntegrations, testIntegration } from "@/lib/admin-ops.functions";
import { PageTitle, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super-admin/integrations")({ component: Integrations });

function Integrations() {
  const qc = useQueryClient();
  const list = useServerFn(listIntegrations),
    test = useServerFn(testIntegration);
  const q = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => list() });
  const stats = useQuery({
    queryKey: ["admin", "connector-operations"],
    queryFn: () => connectorOperations(),
  });
  const t = useMutation({
    mutationFn: (provider: string) => test({ data: { provider } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Working · ${r.ms} ms`);
      else toast.error(r.detail);
      qc.invalidateQueries({ queryKey: ["admin", "integrations"] });
    },
  });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Integrations"
        sub="Every outside service MatrixKeep depends on, with a live connection test."
      />
      <section className="grid gap-3 sm:grid-cols-2">
        {stats.isError && <p>Connector metrics unavailable.</p>}
        {stats.data?.map((p) => (
          <article key={p.provider} className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="font-semibold">
              {
                {
                  google_mail: "Gmail",
                  google_drive: "Google Drive",
                  outlook: "Outlook",
                  onedrive: "OneDrive",
                }[p.provider]
              }
            </h2>
            <p>
              {p.configured ? "Configured" : "Setup required"} · {p.connected} connected ·{" "}
              {p.reconnect} need to reconnect
            </p>
            <p>
              Background checks: {p.successes} successful · {p.failures} failed
            </p>
            <p>
              {p.discovered} discovered · {p.approved} approved · {p.rejected} dismissed
            </p>
            <p>
              {p.ai_calls} AI calls · ${Number(p.estimated_usd).toFixed(5)} estimated provider cost
            </p>
            <p>
              Last successful sync:{" "}
              {p.last_success ? when(p.last_success) : "No successful check yet"}
            </p>
          </article>
        ))}
      </section>
      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(q.data ?? []).map((p) => (
            <div key={p.key} className="rounded-xl border bg-card p-5 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className="font-semibold text-foreground">{p.name}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${p.status === "connected" ? "bg-primary/15 text-primary" : p.status === "failing" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}
                >
                  {p.status === "connected"
                    ? "Connected"
                    : p.status === "failing"
                      ? "Failing"
                      : "Setup required"}
                </span>
              </div>
              {p.missing.length > 0 ? (
                <p className="mt-3 text-muted-foreground">
                  To connect: ask Lovable in chat to connect {p.name}, then enter{" "}
                  {p.missing.join(", ")} in the secure form.
                </p>
              ) : (
                <p className="mt-3 text-muted-foreground">
                  {p.lastChecked
                    ? `Last test ${when(p.lastChecked)} — ${p.notes}`
                    : "Not tested yet."}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={t.isPending || p.missing.length > 0}
                onClick={() => t.mutate(p.key)}
              >
                Test connection
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
