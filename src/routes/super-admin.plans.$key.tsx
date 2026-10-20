import { z } from "zod";
import { jsonObject } from "@/lib/json-values";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { planVersions, savePlanVersion, setPlanVersionStatus } from "@/lib/admin-ops.functions";
import { plans } from "@/lib/plans";
import { defaultEntitlements, type Entitlements } from "@/lib/entitlements";
import { PlanFeatures } from "@/components/hv/PlanFeatures";
import { PageTitle, Table, money, when } from "@/components/hv/AdminKpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/super-admin/plans/$key")({ component: PlanDetail });

const capKeys = ["users", "places", "assets", "storage", "docs", "captures", "sera"] as const;

function PlanDetail() {
  const { key } = Route.useParams();
  const isNew = key === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(planVersions),
    save = useServerFn(savePlanVersion),
    status = useServerFn(setPlanVersionStatus);
  const q = useQuery({
    queryKey: ["admin", "plans", key],
    queryFn: () => list({ data: { key } }),
    enabled: !isNew,
  });
  const live = plans.find((p) => p.key === key);
  const latest = (q.data?.versions ?? [])[0];
  const [f, setF] = useState({
    plan_key: "",
    name: "",
    audience: "individual" as "individual" | "business" | "enterprise",
    monthly: 0 as number | null,
    yearly: 0 as number | null,
    capacity: {} as Record<string, string>,
    benefits: "",
    notes: "",
    entitlements: {} as Entitlements,
  });
  useEffect(() => {
    const src = latest ?? live;
    if (!src || isNew) return;
    setF({
      plan_key: key,
      name: src.name,
      audience:
        src.audience === "business" || src.audience === "enterprise" ? src.audience : "individual",
      monthly: src.monthly == null ? null : Number(src.monthly),
      yearly: src.yearly == null ? null : Number(src.yearly),
      capacity: Object.fromEntries(
        Object.entries(latest ? jsonObject(latest.capacity) : (live?.cap ?? {})).map(([k, v]) => [
          k,
          String(v ?? ""),
        ]),
      ),
      benefits: (src.benefits ?? []).join("\n"),
      notes: "",
      entitlements: {
        ...defaultEntitlements(
          key,
          src.audience === "business" || src.audience === "enterprise"
            ? src.audience
            : "individual",
        ),
        ...(z
          .record(
            z.object({
              on: z.boolean(),
              limit: z.number().nullable().optional(),
              unit: z.enum(["count", "MB", "GB", "TB", "per month"]).optional(),
            }),
          )
          .safeParse(latest?.entitlements).data ?? {}),
      },
    });
  }, [latest?.id, live?.key, isNew]);
  useEffect(() => {
    if (isNew) setF((x) => ({ ...x, entitlements: defaultEntitlements("", x.audience) }));
  }, [isNew, f.audience]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "plans"] });
  const saveM = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...f,
          benefits: f.benefits
            .split("\n")
            .map((b) => b.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Saved as version ${r.version}`);
      refresh();
      if (isNew) navigate({ to: "/super-admin/plans/$key", params: { key: f.plan_key } });
    },
    onError: (e: Error) =>
      toast.error(e.message.startsWith("[") ? "Check the plan key, name and prices" : e.message),
  });
  const stM = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "archived" | "draft" }) =>
      status({ data: v }),
    onSuccess: () => {
      toast.success("Version updated");
      refresh();
    },
  });
  return (
    <div className="space-y-6">
      <Link
        to="/super-admin/plans"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Plans
      </Link>
      <PageTitle
        title={isNew ? "Create plan" : f.name || key}
        sub={
          live
            ? `Live now: ${live.monthly === null ? "Custom" : money(live.monthly)} / month · ${q.data?.counts[key] ?? 0} accounts`
            : "Not live yet — new plans are reviewed before going public."
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveM.mutate();
        }}
        className="grid gap-4 rounded-xl border bg-card p-5 text-sm md:grid-cols-2"
      >
        <label>
          Plan key
          <Input
            value={f.plan_key}
            disabled={!isNew}
            onChange={(e) => setF({ ...f, plan_key: e.target.value })}
            placeholder="e.g. family_plus"
          />
        </label>
        <label>
          Name
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label>
          Audience
          <select
            value={f.audience}
            onChange={(e) => setF({ ...f, audience: e.target.value as typeof f.audience })}
            className="block h-9 w-full rounded-md border bg-background px-2"
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            Monthly £ (blank = custom)
            <Input
              type="number"
              step="0.01"
              value={f.monthly ?? ""}
              onChange={(e) =>
                setF({ ...f, monthly: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </label>
          <label>
            Yearly £
            <Input
              type="number"
              step="0.01"
              value={f.yearly ?? ""}
              onChange={(e) =>
                setF({ ...f, yearly: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-4">
          {capKeys.map((c) => (
            <label key={c} className="capitalize">
              {c}
              <Input
                value={f.capacity[c] ?? ""}
                onChange={(e) => setF({ ...f, capacity: { ...f.capacity, [c]: e.target.value } })}
              />
            </label>
          ))}
        </div>
        <PlanFeatures
          audience={f.audience}
          value={f.entitlements}
          onChange={(entitlements) => setF({ ...f, entitlements })}
        />
        <label className="md:col-span-2">
          Benefits (one per line)
          <Textarea
            rows={5}
            value={f.benefits}
            onChange={(e) => setF({ ...f, benefits: e.target.value })}
          />
        </label>
        <label className="md:col-span-2">
          Change note
          <Input
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            placeholder="What changed and why"
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={saveM.isPending}>
            Save as new version
          </Button>
        </div>
      </form>
      {!isNew && (
        <>
          <h2 className="font-semibold">Version history</h2>
          <Table
            head={["Version", "Status", "Price", "Saved", "Note", "Actions"]}
            empty={(q.data?.versions ?? []).length === 0}
          >
            {(q.data?.versions ?? []).map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-3">v{v.version}</td>
                <td className="p-3 capitalize">{v.status}</td>
                <td className="p-3">{v.monthly == null ? "Custom" : money(Number(v.monthly))}</td>
                <td className="p-3">{when(v.created_at)}</td>
                <td className="p-3">{v.notes}</td>
                <td className="space-x-3 p-3 text-xs">
                  {v.status !== "approved" && (
                    <button
                      onClick={() => stM.mutate({ id: v.id, status: "approved" })}
                      className="text-primary"
                    >
                      Approve
                    </button>
                  )}
                  {v.status !== "archived" && (
                    <button
                      onClick={() => stM.mutate({ id: v.id, status: "archived" })}
                      className="text-muted-foreground"
                    >
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <p className="text-xs text-muted-foreground">
            Approving a version publishes its features & limits to customer accounts straight away
            (existing data is never deleted). Customer prices only change when a version is
            published to the public pricing list, so existing subscribers are never repriced by
            accident.
          </p>
        </>
      )}
    </div>
  );
}
