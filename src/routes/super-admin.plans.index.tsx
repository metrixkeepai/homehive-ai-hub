import { refreshPlans } from "@/lib/plan-status";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { planVersions, setPlanActive, deletePlan, archivePlan } from "@/lib/admin-ops.functions";
import { plans } from "@/lib/plans";
import { PageTitle, Table, money } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/plans/")({ component: Plans });

function Plans() {
  const fn = useServerFn(planVersions),
    act = useServerFn(setPlanActive),
    del = useServerFn(deletePlan),
    arc = useServerFn(archivePlan);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fn({ data: {} }) });
  const versions = q.data?.versions ?? [];
  const inactive = new Set(q.data?.inactive ?? []);
  const newKeys = [...new Set(versions.map((v) => v.plan_key))].filter(
    (k) => !plans.some((p) => p.key === k),
  );
  const done = () => refreshPlans(qc);
  const err = (e: Error) => toast.error(e.message);
  const actM = useMutation({
    mutationFn: (v: { key: string; active: boolean }) => act({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.active ? "Plan activated" : "Plan deactivated");
      done();
    },
    onError: err,
  });
  const delM = useMutation({
    mutationFn: (key: string) => del({ data: { key } }),
    onSuccess: () => {
      toast.success("Plan deleted");
      done();
    },
    onError: err,
  });
  const arcM = useMutation({
    mutationFn: (key: string) => arc({ data: { key } }),
    onSuccess: () => {
      toast.success("Plan archived — existing subscribers keep it");
      done();
    },
    onError: err,
  });
  const archived = (key: string) =>
    inactive.has(key) &&
    versions.some((v) => v.plan_key === key) &&
    versions.filter((v) => v.plan_key === key).every((v) => v.status === "archived");
  const actions = (key: string, canDelete: boolean) => (
    <td className="space-x-3 p-3 text-xs">
      <button
        disabled={actM.isPending}
        onClick={() => actM.mutate({ key, active: inactive.has(key) })}
        className="text-primary"
      >
        {inactive.has(key) ? "Activate" : "Deactivate"}
      </button>
      {!archived(key) && (
        <button
          disabled={arcM.isPending}
          onClick={() => {
            if (
              confirm(
                `Archive ${key}? It will be hidden from new customers and all versions archived.`,
              )
            )
              arcM.mutate(key);
          }}
          className="text-muted-foreground"
        >
          Archive
        </button>
      )}
      {canDelete && (
        <button
          disabled={delM.isPending}
          onClick={() => {
            if (
              confirm(
                `Delete plan ${key} and all its versions? This only works if nothing depends on it.`,
              )
            )
              delM.mutate(key);
          }}
          className="text-destructive"
        >
          Delete
        </button>
      )}
    </td>
  );
  const state = (key: string) =>
    archived(key) ? (
      <span className="text-xs text-muted-foreground"> · archived</span>
    ) : inactive.has(key) ? (
      <span className="text-xs text-muted-foreground"> · inactive</span>
    ) : null;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Plans"
        sub="Live plans power the public pricing page and every account. Deactivated plans are hidden from new customers; existing subscribers keep them."
      >
        <Link
          to="/super-admin/plans/$key"
          params={{ key: "new" }}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Create plan
        </Link>
      </PageTitle>
      <Table
        head={[
          "Plan",
          "Audience",
          "Monthly",
          "Yearly",
          "Accounts",
          "Latest version",
          "Trial",
          "Actions",
        ]}
      >
        {plans.map((p) => {
          const v = versions.find((x) => x.plan_key === p.key);
          return (
            <tr key={p.key} className="border-t hover:bg-muted/30">
              <td className="p-3">
                <Link
                  to="/super-admin/plans/$key"
                  params={{ key: p.key }}
                  className="font-medium hover:text-primary"
                >
                  {p.name}
                </Link>
                {state(p.key)}
              </td>
              <td className="p-3 capitalize">{p.audience}</td>
              <td className="p-3">{p.monthly === null ? "Custom" : money(p.monthly)}</td>
              <td className="p-3">{p.yearly == null ? "—" : money(p.yearly)}</td>
              <td className="p-3">{q.data?.counts[p.key] ?? 0}</td>
              <td className="p-3">{v ? `v${v.version} · ${v.status}` : "Live only"}</td>
              <td className="p-3">{p.key === "business_starter" ? "14 days" : "—"}</td>
              {p.key === "free" ? (
                <td className="p-3 text-xs text-muted-foreground">Required</td>
              ) : (
                actions(p.key, false)
              )}
            </tr>
          );
        })}
        {newKeys.map((k) => {
          const v = versions.find((x) => x.plan_key === k);
          if (!v) return null;
          return (
            <tr key={k} className="border-t">
              <td className="p-3">
                <Link
                  to="/super-admin/plans/$key"
                  params={{ key: k }}
                  className="font-medium hover:text-primary"
                >
                  {v.name}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">new</span>
                {state(k)}
              </td>
              <td className="p-3 capitalize">{v.audience}</td>
              <td className="p-3">{v.monthly == null ? "Custom" : money(Number(v.monthly))}</td>
              <td className="p-3">{v.yearly == null ? "—" : money(Number(v.yearly))}</td>
              <td className="p-3">{q.data?.counts[k] ?? 0}</td>
              <td className="p-3">
                v{v.version} · {v.status}
              </td>
              <td className="p-3">—</td>
              {actions(k, true)}
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
