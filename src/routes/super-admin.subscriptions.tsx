import { jsonObject, jsonString } from "@/lib/json-values";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listSubscribers, listAudit } from "@/lib/admin.functions";
import { plans, planByKey } from "@/lib/plans";
import { Kpi, PageTitle, Table, when } from "@/components/hv/AdminKpi";

export const Route = createFileRoute("/super-admin/subscriptions")({ component: Subs });

const sourceLabel = (s: string | null) =>
  !s || s === "default"
    ? "Free"
    : s === "trial"
      ? "Trial"
      : s === "stripe"
        ? "Card"
        : s === "admin"
          ? "Admin granted"
          : s.startsWith("voucher")
            ? "Voucher"
            : s;

function Subs() {
  const subs = useServerFn(listSubscribers),
    aud = useServerFn(listAudit);
  const q = useQuery({
    queryKey: ["admin", "subs", "all", ""],
    queryFn: () => subs({ data: { type: "all", q: "" } }),
  });
  const a = useQuery({ queryKey: ["admin", "audit"], queryFn: () => aud() });
  const [plan, setPlan] = useState("all");
  const [source, setSource] = useState("all");
  const [view, setView] = useState<"all" | "trials" | "changes">("all");
  const rows = q.data ?? [];
  const now = Date.now();
  const trials = rows.filter((r) => r.plan_source === "trial" && r.trial_ends_at);
  const shown = useMemo(
    () =>
      (view === "trials" ? trials : rows).filter(
        (r) =>
          (plan === "all" || r.plan === plan) &&
          (source === "all" || sourceLabel(r.plan_source) === source),
      ),
    [rows, plan, source, view],
  );
  const changes = (a.data ?? []).filter((x) =>
    ["plan_override", "trial_extended"].includes(x.action),
  );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Subscriptions"
        sub="Every account's plan, how they got it, and trial status."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Active trials"
          value={trials.filter((t) => new Date(t.trial_ends_at ?? 0).getTime() > now).length}
          onClick={() => setView("trials")}
        />
        <Kpi
          label="Trials ending in 3 days"
          value={
            trials.filter((t) => {
              const d = new Date(t.trial_ends_at ?? 0).getTime() - now;
              return d > 0 && d < 3 * 864e5;
            }).length
          }
          onClick={() => setView("trials")}
        />
        <Kpi
          label="Expired trials"
          value={trials.filter((t) => new Date(t.trial_ends_at ?? 0).getTime() <= now).length}
          onClick={() => setView("trials")}
        />
        <Kpi
          label="Plan changes by admins"
          value={changes.length}
          onClick={() => setView("changes")}
        />
      </section>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "trials", "changes"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 capitalize ${view === v ? "bg-foreground text-background" : "border bg-card"}`}
          >
            {v === "all"
              ? "All subscriptions"
              : v === "trials"
                ? "Trials"
                : "Upgrades & downgrades"}
          </button>
        ))}
        {view !== "changes" && (
          <>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="rounded-md border bg-background px-2"
            >
              <option value="all">All plans</option>
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-md border bg-background px-2"
            >
              {["all", "Free", "Trial", "Card", "Voucher", "Admin granted"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Any source" : s}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {view === "changes" ? (
        <Table head={["When", "Change", "Account", "Reason"]} empty={changes.length === 0}>
          {changes.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">{when(c.created_at)}</td>
              <td className="p-3">
                {c.action === "plan_override"
                  ? `${planByKey(jsonString(jsonObject(c.details)["from"])).name} → ${planByKey(jsonString(jsonObject(c.details)["to"])).name}`
                  : `Trial +${jsonObject(c.details)["days"]} days`}
              </td>
              <td className="p-3">
                <Link
                  to="/super-admin/subscribers/$id"
                  params={{ id: c.target ?? "" }}
                  className="text-primary"
                >
                  Open account
                </Link>
              </td>
              <td className="p-3">{c.reason}</td>
            </tr>
          ))}
        </Table>
      ) : q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table
          head={["Account", "Plan", "Source", "Trial ends", "Status"]}
          empty={shown.length === 0}
        >
          {shown.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="p-3">
                <Link
                  to="/super-admin/subscribers/$id"
                  params={{ id: r.id }}
                  className="font-medium hover:text-primary"
                >
                  {r.org_name || r.display_name || r.email}
                </Link>
                <p className="text-xs text-muted-foreground">{r.email}</p>
              </td>
              <td className="p-3">{planByKey(r.plan).name}</td>
              <td className="p-3">{sourceLabel(r.plan_source)}</td>
              <td className="p-3">
                {r.trial_ends_at ? new Date(r.trial_ends_at ?? 0).toLocaleDateString("en-GB") : "—"}
              </td>
              <td className="p-3">
                {r.suspended ? (
                  <span className="text-destructive">Suspended</span>
                ) : r.trial_ends_at &&
                  new Date(r.trial_ends_at ?? 0).getTime() < now &&
                  r.plan_source === "trial" ? (
                  "Trial expired"
                ) : (
                  "Active"
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
