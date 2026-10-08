import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Copy } from "lucide-react";
import { listSubscribers, createAccount } from "@/lib/admin.functions";
import { planByKey, plans } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kpi } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/subscribers/")({ component: Subscribers });

const types = ["all", "individual", "business", "enterprise"] as const;
type AType = "individual" | "business" | "enterprise";
const blurb: Record<AType, string> = { individual: "Homeowners, renters and families.", business: "Shops, clinics, offices and other SMEs.", enterprise: "Large, multi-site organisations." };

function Subscribers() {
  const fn = useServerFn(listSubscribers);
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [add, setAdd] = useState<AType | "pick" | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "subs", type, q], queryFn: () => fn({ data: { type, q } }) });
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const view = rows.slice((page - 1) * size, page * size);
  const k = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r: any) => !r.suspended).length,
    suspended: rows.filter((r: any) => r.suspended).length,
    paid: rows.filter((r: any) => r.plan !== "free").length,
  }), [rows]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-3xl text-foreground">Subscribers</h1>
        <Button onClick={() => setAdd("pick")}><Plus />Add Account</Button>
        {(["individual", "business", "enterprise"] as AType[]).map((t) => <Button key={t} variant="outline" size="sm" className="capitalize" onClick={() => setAdd(t)}>+ {t}</Button>)}
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => { setType("all"); setPage(1); }} className="text-left"><Kpi label="Accounts shown" value={k.total} /></button>
        <Kpi label="Active" value={k.active} />
        <Kpi label="Suspended" value={k.suspended} />
        <Kpi label="On a paid or granted plan" value={k.paid} />
      </section>
      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => <button key={t} onClick={() => { setType(t); setPage(1); }} className={`rounded-full border px-3 py-1 text-sm capitalize ${type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{t}</button>)}
        <Input placeholder="Search email, name or organisation" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="ml-auto max-w-xs" />
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : error ? <p className="text-destructive">{(error as Error).message}</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Account</th><th className="p-3">Type</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3">Last sign in</th></tr></thead>
            <tbody>{view.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3"><Link to="/super-admin/subscribers/$id" params={{ id: r.id }} className="font-medium text-foreground hover:text-primary">{r.org_name || r.display_name || "—"}</Link><p className="text-xs text-muted-foreground">{r.email}</p></td>
                <td className="p-3 capitalize">{r.account_type}</td>
                <td className="p-3">{planByKey(r.plan).name}{r.plan_source && r.plan_source !== "default" ? <span className="text-xs text-muted-foreground"> · {r.plan_source}</span> : null}</td>
                <td className="p-3">{r.suspended ? <span className="text-destructive">Suspended</span> : "Active"}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                <td className="p-3 text-muted-foreground">{r.last_sign_in ? new Date(r.last_sign_in).toLocaleDateString("en-GB") : "Never"}</td>
              </tr>))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No accounts match.</td></tr>}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3 border-t p-3 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} className="rounded-md border bg-background px-2 py-1">{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
            <span className="ml-auto">Page {page} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>)}
      <AddAccount open={add} onClose={() => setAdd(null)} onPick={setAdd} />
    </div>
  );
}

function AddAccount({ open, onClose, onPick }: { open: AType | "pick" | null; onClose: () => void; onPick: (t: AType) => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createAccount);
  const [f, setF] = useState({ email: "", name: "", org_name: "", phone: "", sector: "", plan: "free", method: "invite" as "invite" | "temp" });
  const [result, setResult] = useState<{ id: string; password: string | null } | null>(null);
  const type = open && open !== "pick" ? open : null;
  const m = useMutation({
    mutationFn: () => create({ data: { ...f, account_type: type!, origin: window.location.origin } }),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["admin"] }); toast.success(f.method === "invite" ? "Invitation sent" : "Account created"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = () => { setResult(null); setF({ email: "", name: "", org_name: "", phone: "", sector: "", plan: "free", method: "invite" }); onClose(); };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const audience = type === "individual" ? "individual" : type;
  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{result ? "Account ready" : type ? `New ${type} account` : "What type of account do you want to create?"}</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            {result.password ? <>
              <p>Give this temporary password to the customer. It is shown only once and they must change it when they first sign in.</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono">{result.password}<Button size="icon" variant="ghost" className="ml-auto" onClick={() => { navigator.clipboard.writeText(result.password!); toast.success("Copied"); }}><Copy /></Button></div>
            </> : <p>An invitation email has been sent. The customer sets their own password from the link.</p>}
            <div className="flex gap-2"><Button asChild><Link to="/super-admin/subscribers/$id" params={{ id: result.id }} onClick={close}>Open account</Link></Button><Button variant="outline" onClick={close}>Done</Button></div>
          </div>
        ) : !type ? (
          <div className="grid gap-3">{(["individual", "business", "enterprise"] as AType[]).map((t) => <button key={t} onClick={() => onPick(t)} className="rounded-xl border p-4 text-left hover:border-primary"><p className="font-semibold capitalize text-foreground">{t}</p><p className="text-sm text-muted-foreground">{blurb[t]}</p></button>)}</div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
            <Input required type="email" placeholder="Email" value={f.email} onChange={set("email")} />
            <Input required placeholder={type === "individual" ? "Full name" : "Main contact name"} value={f.name} onChange={set("name")} />
            {type !== "individual" && <><Input required placeholder="Organisation name" value={f.org_name} onChange={set("org_name")} /><Input placeholder="Industry / sector" value={f.sector} onChange={set("sector")} /></>}
            <Input placeholder="Phone (optional)" value={f.phone} onChange={set("phone")} />
            <label className="block text-xs text-muted-foreground">Plan
              <select value={f.plan} onChange={set("plan")} className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground">{plans.filter((p) => p.key === "free" || p.audience === audience).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(["invite", "temp"] as const).map((x) => <button type="button" key={x} onClick={() => setF({ ...f, method: x })} className={`rounded-md border p-2 ${f.method === x ? "border-primary bg-primary/10" : ""}`}>{x === "invite" ? "Email a setup link" : "Generate temporary password"}</button>)}
            </div>
            <Button disabled={m.isPending} className="w-full">{m.isPending ? "Creating…" : "Create account"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
