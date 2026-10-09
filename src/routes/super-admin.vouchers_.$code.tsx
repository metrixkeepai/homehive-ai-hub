import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { voucherDetail } from "@/lib/vouchers.functions";
import { Kpi, when } from "@/components/hv/AdminKpi";
import { DataTable } from "@/components/hv/BillingKit";
import { Button } from "@/components/ui/button";
import { planByKey } from "@/lib/plans";

export const Route = createFileRoute("/super-admin/vouchers_/$code")({ component: VoucherDetail });

function VoucherDetail() {
  const { code } = Route.useParams();
  const fn = useServerFn(voucherDetail);
  const q = useQuery({ queryKey: ["admin", "voucher", code], queryFn: () => fn({ data: { code } }), retry: 2 });
  const back = <Link to="/super-admin/vouchers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Vouchers</Link>;
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <div className="space-y-2">{back}<p className="text-destructive">{(q.error as Error)?.message ?? "Not found"}</p><Button variant="outline" onClick={() => q.refetch()}>Try again</Button></div>;
  const { voucher: v, redemptions, batch } = q.data;
  const len = v.benefit_ends_on ? `until ${new Date(v.benefit_ends_on).toLocaleDateString("en-GB")}` : v.duration_months ? `${v.duration_months} months from redemption` : "no end date";
  return (
    <div className="space-y-6">
      {back}
      <div><h1 className="font-mono text-3xl text-foreground">{v.code}</h1><p className="text-sm text-muted-foreground">{v.name || "Unnamed"}{v.description && ` · ${v.description}`}</p></div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="State" value={v.state} /><Kpi label="Redeemed" value={`${v.uses} / ${v.max_uses}`} /><Kpi label="Plan" value={planByKey(v.plan).name} hint={v.benefit_type.replace(/_/g, " ")} /><Kpi label="Benefit lasts" value={len} />
      </section>
      <section className="rounded-xl border bg-card p-5 text-sm">
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[["Code type", v.code_type], ["Value", v.benefit_value ?? "—"], ["Redeem from", v.valid_from ? when(v.valid_from) : "Now"], ["Redeem until", v.valid_until ? when(v.valid_until) : "No end"], ["Who", v.audiences.length ? v.audiences.join(", ") : "Everyone"], ["Assigned to", v.assigned_email ?? "—"], ["Once per account", v.one_per_user ? "Yes" : "No"], ["Created", when(v.created_at)]].map(([k, x]) => <div key={String(k)}><dt className="text-muted-foreground">{k}</dt><dd className="capitalize">{String(x)}</dd></div>)}</dl>
      </section>
      <section className="space-y-3"><h2 className="font-semibold">Redemption history</h2>
        <DataTable name={`redemptions-${v.code}`} rows={redemptions} cols={[{ key: "created_at", label: "Date", render: (r) => when(r.created_at) }, { key: "account", label: "Account", render: (r) => <Link to="/super-admin/subscribers/$id" params={{ id: r.user_id }} className="text-primary">{r.account}</Link> }, { key: "plan_before", label: "Plan before", render: (r) => planByKey(r.plan_before ?? "free").name }, { key: "plan_after", label: "Plan after", render: (r) => planByKey(r.plan_after ?? "free").name }, { key: "benefit_ends_at", label: "Benefit ends", render: (r) => r.benefit_ends_at ? when(r.benefit_ends_at) : "—" }]} />
      </section>
      {batch.length > 1 && <section className="space-y-3"><h2 className="font-semibold">Other codes in this batch</h2>
        <DataTable name={`batch-${v.batch}`} rows={batch.map((b) => ({ id: b.code, ...b, status: b.uses ? "redeemed" : b.active ? "unused" : "paused" }))} filters={[{ key: "status", label: "Statuses" }]} cols={[{ key: "code", label: "Code", render: (r) => <Link to="/super-admin/vouchers/$code" params={{ code: r.code }} className="font-mono text-primary">{r.code}</Link> }, { key: "status", label: "Status" }]} />
      </section>}
    </div>
  );
}
