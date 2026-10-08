import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getSubscriber, overridePlan, setSuspended, extendTrial } from "@/lib/admin.functions";
import { plans, planByKey } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kpi } from "@/components/hv/AdminKpi";
import { Fragment } from "react";

export const Route = createFileRoute("/super-admin/subscribers/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getSubscriber);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "sub", id], queryFn: () => get({ data: { id } }), retry: 2 });
  const ov = useServerFn(overridePlan), sus = useServerFn(setSuspended), ext = useServerFn(extendTrial);
  const [plan, setPlan] = useState("");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const done = (msg: string) => () => { toast.success(msg); setReason(""); qc.invalidateQueries({ queryKey: ["admin"] }); };
  const fail = (e: Error) => toast.error(e.message.includes("reason") || e.message.includes("[") ? "Give a reason of at least 3 characters" : e.message);
  const planM = useMutation({ mutationFn: () => ov({ data: { id, plan, reason } }), onSuccess: done("Plan changed"), onError: fail });
  const susM = useMutation({ mutationFn: (s: boolean) => sus({ data: { id, suspended: s, reason } }), onSuccess: done("Account updated"), onError: fail });
  const trialM = useMutation({ mutationFn: () => ext({ data: { id, days, reason } }), onSuccess: done("Trial extended"), onError: fail });

  if (isLoading) return <p className="text-muted-foreground">Loading account…</p>;
  if (error || !data) {
    const msg = (error as Error)?.message ?? "";
    return (
      <div className="space-y-3">
        <p className="text-destructive">{/fetch/i.test(msg) ? "Couldn't reach the server. Check your connection and try again." : msg || "Account not found."}</p>
        <Button variant="outline" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }
  const p = data.profile as any;
  return (
    <div className="space-y-6">
      <Link to="/super-admin/subscribers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Subscribers</Link>
      <div>
        <h1 className="font-display text-3xl text-foreground">{p.org_name || p.display_name || data.email}</h1>
        <p className="text-sm text-muted-foreground">{data.email} · {p.account_type} · signed up with {data.provider} · {data.confirmed ? "email confirmed" : "email not confirmed"}{p.suspended && <span className="text-destructive"> · Suspended</span>}</p>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Plan" value={planByKey(p.plan).name} hint={p.plan_source ?? undefined} />
        <Kpi label="Records" value={data.records} />
        <Kpi label="Evidence files" value={data.files} />
        <Kpi label="Last sign in" value={data.lastSignIn ? new Date(data.lastSignIn).toLocaleDateString("en-GB") : "Never"} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold text-foreground">Profile</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2">
            {[["Name", p.display_name], ["Phone", p.phone], ["Organisation", p.org_name], ["Sector", p.sector], ["Business type", p.business_type], ["Size", p.org_size], ["Locations", p.branches], ["Trial ends", p.trial_ends_at && new Date(p.trial_ends_at).toLocaleDateString("en-GB")], ["Joined", new Date(p.created_at).toLocaleDateString("en-GB")], ["Workspaces", data.workspaces.map((w: any) => w.name).join(", ")]].map(([k, v]) => <Fragment key={String(k)}><dt className="text-muted-foreground">{k}</dt><dd>{v || "—"}</dd></Fragment>)}
          </dl>
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold text-foreground">Admin actions</h2>
          <div><label className="text-xs text-muted-foreground">Reason (required, saved to the audit log)</label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Support ticket 1042" /></div>
          <div className="flex gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="flex-1 rounded-md border bg-background px-2"><option value="">Change plan to…</option>{plans.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
            <Button disabled={!plan || planM.isPending} onClick={() => planM.mutate()}>Apply</Button>
          </div>
          <div className="flex gap-2">
            <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" />
            <Button variant="outline" disabled={trialM.isPending} onClick={() => trialM.mutate()}>Extend Business Starter trial by days</Button>
          </div>
          <Button variant={p.suspended ? "outline" : "destructive"} disabled={susM.isPending} onClick={() => susM.mutate(!p.suspended)}>{p.suspended ? "Restore account" : "Suspend account (blocks sign in)"}</Button>
          <p className="text-xs text-muted-foreground">Accounts are never deleted from here; suspension is reversible.</p>
        </section>
      </div>
      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-semibold text-foreground">Admin history for this account</h2>
        {data.history.length === 0 ? <p className="mt-2 text-muted-foreground">No admin actions yet.</p> :
          <ul className="mt-2 divide-y">{data.history.map((h: any) => <li key={h.id} className="py-2"><span className="font-medium">{h.action.replace(/_/g, " ")}</span> <span className="text-muted-foreground">— {h.reason} · {new Date(h.created_at).toLocaleString("en-GB")}</span></li>)}</ul>}
      </section>
    </div>
  );
}
