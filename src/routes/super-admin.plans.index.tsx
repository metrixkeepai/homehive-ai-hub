import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { planVersions } from "@/lib/admin-ops.functions";
import { plans } from "@/lib/plans";
import { PageTitle, Table, money } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/plans/")({ component: Plans });

function Plans() {
  const fn = useServerFn(planVersions);
  const q = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fn({ data: {} }) });
  const versions = (q.data?.versions ?? []) as any[];
  const newKeys = [...new Set(versions.map((v) => v.plan_key))].filter((k) => !plans.some((p) => p.key === k));
  return (
    <div className="space-y-6">
      <PageTitle title="Plans" sub="Live plans power the public pricing page and every account. Edits are saved as numbered versions for review.">
        <Link to="/super-admin/plans/$key" params={{ key: "new" }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create plan</Link>
      </PageTitle>
      <Table head={["Plan", "Audience", "Monthly", "Yearly", "Accounts", "Latest version", "Trial"]}>
        {plans.map((p) => { const v = versions.find((x) => x.plan_key === p.key); return (
          <tr key={p.key} className="border-t hover:bg-muted/30"><td className="p-3"><Link to="/super-admin/plans/$key" params={{ key: p.key }} className="font-medium hover:text-primary">{p.name}</Link></td><td className="p-3 capitalize">{p.audience}</td><td className="p-3">{p.monthly === null ? "Custom" : money(p.monthly)}</td><td className="p-3">{p.yearly == null ? "—" : money(p.yearly)}</td><td className="p-3">{q.data?.counts[p.key] ?? 0}</td><td className="p-3">{v ? `v${v.version} · ${v.status}` : "Live only"}</td><td className="p-3">{p.key === "business_starter" ? "14 days" : "—"}</td></tr>); })}
        {newKeys.map((k) => { const v = versions.find((x) => x.plan_key === k); return <tr key={k} className="border-t"><td className="p-3"><Link to="/super-admin/plans/$key" params={{ key: k }} className="font-medium hover:text-primary">{v.name}</Link> <span className="text-xs text-muted-foreground">new</span></td><td className="p-3 capitalize">{v.audience}</td><td className="p-3">{v.monthly == null ? "Custom" : money(Number(v.monthly))}</td><td className="p-3">{v.yearly == null ? "—" : money(Number(v.yearly))}</td><td className="p-3">0</td><td className="p-3">v{v.version} · {v.status}</td><td className="p-3">—</td></tr>; })}
      </Table>
    </div>
  );
}
