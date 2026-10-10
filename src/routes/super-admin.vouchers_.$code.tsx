import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { voucherDetail } from "@/lib/vouchers.functions";
import { updateVoucher, deleteVoucher, toggleVoucher } from "@/lib/admin.functions";
import { Kpi, when } from "@/components/hv/AdminKpi";
import { DataTable } from "@/components/hv/BillingKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { planByKey } from "@/lib/plans";

export const Route = createFileRoute("/super-admin/vouchers_/$code")({ component: VoucherDetail });

function EditVoucher({ v, onSaved }: { v: any; onSaved: () => void }) {
  const up = useServerFn(updateVoucher), del = useServerFn(deleteVoucher), tog = useServerFn(toggleVoucher);
  const nav = useNavigate();
  const [f, setF] = useState({ name: v.name ?? "", description: v.description ?? "", max_uses: v.max_uses as number, valid_until: v.valid_until ? String(v.valid_until).slice(0, 10) : "" });
  const err = (e: Error) => toast.error(e.message);
  const save = useMutation({ mutationFn: () => up({ data: { code: v.code, name: f.name, description: f.description, max_uses: f.max_uses, valid_until: f.valid_until ? new Date(f.valid_until + "T23:59:59Z").toISOString() : null } }), onSuccess: () => { toast.success("Voucher saved"); onSaved(); }, onError: err });
  const rm = useMutation({ mutationFn: () => del({ data: { code: v.code } }), onSuccess: () => { toast.success("Voucher deleted"); nav({ to: "/super-admin/vouchers" }); }, onError: err });
  const tg = useMutation({ mutationFn: () => tog({ data: { code: v.code, active: !v.active } }), onSuccess: () => { toast.success(v.active ? "Paused" : "Activated"); onSaved(); }, onError: err });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
      <h2 className="font-semibold">Edit voucher</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Description<Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label>Max uses<Input type="number" min={1} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: Number(e.target.value) })} /></label>
        <label>Redeem until<Input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        <Button variant="outline" disabled={tg.isPending} onClick={() => tg.mutate()}>{v.active ? "Pause" : "Activate"}</Button>
        <Button variant="destructive" disabled={rm.isPending} onClick={() => { if (confirm(`Delete ${v.code}?`)) rm.mutate(); }}>Delete</Button>
      </div>
    </section>
  );
}

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
      <EditVoucher v={v} onSaved={() => q.refetch()} />
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
