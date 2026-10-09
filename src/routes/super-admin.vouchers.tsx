import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listVouchers, createVoucher, toggleVoucher } from "@/lib/admin.functions";
import { plans, planByKey } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/super-admin/vouchers")({ component: Vouchers });

function Vouchers() {
  const qc = useQueryClient();
  const list = useServerFn(listVouchers), create = useServerFn(createVoucher), toggle = useServerFn(toggleVoucher);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "vouchers"], queryFn: () => list() });
  const [code, setCode] = useState(""); const [plan, setPlan] = useState("plus"); const [max, setMax] = useState(100);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const createM = useMutation({ mutationFn: () => create({ data: { code, plan, max_uses: max } }), onSuccess: () => { toast.success("Voucher created"); setCode(""); refresh(); }, onError: (e: Error) => toast.error(e.message.startsWith("[") ? "Use 4–32 letters, numbers, - or _" : e.message) });
  const toggleM = useMutation({ mutationFn: (v: { code: string; active: boolean }) => toggle({ data: v }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-foreground">Vouchers</h1>
      <form onSubmit={(e) => { e.preventDefault(); createM.mutate(); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5 text-sm">
        <div><label className="text-xs text-muted-foreground">Code</label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SPRING2027" /></div>
        <div><label className="block text-xs text-muted-foreground">Gives plan</label><select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 rounded-md border bg-background px-2">{plans.filter((p) => p.monthly !== null).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
        <div><label className="text-xs text-muted-foreground">Max uses</label><Input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-28" /></div>
        <Button type="submit" disabled={!code || createM.isPending}>Create voucher</Button>
      </form>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : error ? <div className="space-y-2"><p className="text-destructive">Couldn't reach the server. Check your connection and try again.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Code</th><th className="p-3">Plan</th><th className="p-3">Used</th><th className="p-3">Created</th><th className="p-3">Active</th></tr></thead>
            <tbody>{(data ?? []).map((v: any) => (
              <tr key={v.code} className="border-t"><td className="p-3 font-mono">{v.code}</td><td className="p-3">{planByKey(v.plan).name}</td><td className="p-3">{v.uses} / {v.max_uses}</td><td className="p-3 text-muted-foreground">{new Date(v.created_at).toLocaleDateString("en-GB")}</td>
                <td className="p-3"><Switch checked={v.active} onCheckedChange={(a) => toggleM.mutate({ code: v.code, active: a })} aria-label={`Toggle ${v.code}`} /></td></tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}
