import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSubscribers } from "@/lib/admin.functions";
import { planByKey } from "@/lib/plans";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/super-admin/subscribers/")({ component: Subscribers });

const types = ["all", "individual", "business", "enterprise"] as const;

function Subscribers() {
  const fn = useServerFn(listSubscribers);
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "subs", type, q], queryFn: () => fn({ data: { type, q } }) });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-foreground">Subscribers</h1>
      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1 text-sm capitalize ${type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{t}</button>)}
        <Input placeholder="Search email, name or organisation" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto max-w-xs" />
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : error ? <p className="text-destructive">{(error as Error).message}</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Account</th><th className="p-3">Type</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3">Last sign in</th></tr></thead>
            <tbody>{data!.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3"><Link to="/super-admin/subscribers/$id" params={{ id: r.id }} className="font-medium text-foreground hover:text-primary">{r.org_name || r.display_name || "—"}</Link><p className="text-xs text-muted-foreground">{r.email}</p></td>
                <td className="p-3 capitalize">{r.account_type}</td>
                <td className="p-3">{planByKey(r.plan).name}{r.plan_source && r.plan_source !== "default" ? <span className="text-xs text-muted-foreground"> · {r.plan_source}</span> : null}</td>
                <td className="p-3">{r.suspended ? <span className="text-destructive">Suspended</span> : "Active"}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                <td className="p-3 text-muted-foreground">{r.last_sign_in ? new Date(r.last_sign_in).toLocaleDateString("en-GB") : "Never"}</td>
              </tr>))}
              {data!.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No accounts match.</td></tr>}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}
