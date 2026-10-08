import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listFlags, saveFlag, deleteFlag } from "@/lib/admin-ops.functions";
import { PageTitle, Table, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/super-admin/flags")({ component: Flags });
type Aud = "individual" | "business" | "enterprise";
const blank = { key: "", name: "", description: "", enabled: false, audiences: [] as Aud[], rollout: 100 };

function Flags() {
  const qc = useQueryClient();
  const list = useServerFn(listFlags), save = useServerFn(saveFlag), del = useServerFn(deleteFlag);
  const q = useQuery({ queryKey: ["admin", "flags"], queryFn: () => list() });
  const [f, setF] = useState(blank);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "flags"] });
  const saveM = useMutation({ mutationFn: (v: typeof blank) => save({ data: v }), onSuccess: () => { toast.success("Saved"); refresh(); }, onError: (e: Error) => toast.error(e.message.startsWith("[") ? "Check the key (lowercase, no spaces) and name" : e.message) });
  const delM = useMutation({ mutationFn: (key: string) => del({ data: { key } }), onSuccess: refresh });
  const toggleAud = (a: Aud) => setF({ ...f, audiences: f.audiences.includes(a) ? f.audiences.filter((x) => x !== a) : [...f.audiences, a] });
  return (
    <div className="space-y-6">
      <PageTitle title="Feature switches" sub="Turn features on for chosen account types and a percentage of accounts. Every change is audited." />
      <form onSubmit={(e) => { e.preventDefault(); saveM.mutate(f); setF(blank); }} className="grid gap-3 rounded-xl border bg-card p-5 text-sm md:grid-cols-2">
        <label>Key<Input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="sera.voice" /></label>
        <label>Name<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="md:col-span-2">Description<Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="flex flex-wrap items-center gap-3">For: {(["individual", "business", "enterprise"] as Aud[]).map((a) => <label key={a} className="flex items-center gap-1 capitalize"><input type="checkbox" checked={f.audiences.includes(a)} onChange={() => toggleAud(a)} />{a}</label>)}</div>
        <label>Rollout %<Input type="number" min={0} max={100} value={f.rollout} onChange={(e) => setF({ ...f, rollout: Number(e.target.value) })} className="w-24" /></label>
        <label className="flex items-center gap-2"><Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} />On</label>
        <div><Button type="submit" disabled={!f.key || !f.name}>Save switch</Button></div>
      </form>
      <Table head={["Switch", "For", "Rollout", "Updated", "On", ""]} empty={(q.data ?? []).length === 0}>
        {(q.data ?? []).map((x: any) => <tr key={x.key} className="border-t"><td className="p-3"><button onClick={() => setF({ key: x.key, name: x.name, description: x.description, enabled: x.enabled, audiences: x.audiences, rollout: x.rollout })} className="text-left font-medium hover:text-primary">{x.name}</button><p className="font-mono text-xs text-muted-foreground">{x.key}</p></td><td className="p-3 capitalize">{x.audiences.length ? x.audiences.join(", ") : "Everyone"}</td><td className="p-3">{x.rollout}%</td><td className="p-3">{when(x.updated_at)}</td>
          <td className="p-3"><Switch checked={x.enabled} onCheckedChange={(v) => saveM.mutate({ key: x.key, name: x.name, description: x.description, audiences: x.audiences, rollout: x.rollout, enabled: v })} aria-label={`Toggle ${x.name}`} /></td><td className="p-3"><button onClick={() => delM.mutate(x.key)} className="text-xs text-destructive">Delete</button></td></tr>)}
      </Table>
    </div>
  );
}
