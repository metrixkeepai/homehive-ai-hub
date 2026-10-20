import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, type Ctx } from "@/lib/admin.functions";
import { planByKey } from "@/lib/plans";
import { storageBytes } from "@/lib/account-usage.functions";

export const dashboardCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const [
      { data: profs },
      { data: items },
      { data: files },
      { data: ai },
      { data: health },
      { data: red },
    ] = await Promise.all([
      db
        .from("profiles")
        .select(
          "id, display_name, org_name, plan, plan_source, trial_ends_at, voucher_ends_at, created_at",
        ),
      db.from("home_items").select("created_at").gte("created_at", since),
      db.from("evidence_files").select("user_id, size, created_at"),
      db.from("ai_usage_log").select("created_at, ok").gte("created_at", since),
      db
        .from("health_checks")
        .select("service, ok, latency_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      db.from("voucher_redemptions").select("created_at").gte("created_at", since),
    ]);
    const days: Record<
      string,
      {
        day: string;
        signups: number;
        records: number;
        uploads: number;
        ai: number;
        vouchers: number;
      }
    > = {};
    for (let i = 29; i >= 0; i--) {
      const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      days[k] = { day: k.slice(5), signups: 0, records: 0, uploads: 0, ai: 0, vouchers: 0 };
    }
    const bump = (
      rows: { created_at: string }[] | null,
      f: "signups" | "records" | "uploads" | "ai" | "vouchers",
    ) =>
      (rows ?? []).forEach((r) => {
        const d = days[r.created_at.slice(0, 10)];
        if (d) d[f]++;
      });
    bump(profs, "signups");
    bump(items, "records");
    bump(files, "uploads");
    bump(ai, "ai");
    bump(red, "vouchers");
    const src: Record<string, number> = {};
    (profs ?? []).forEach((p) => {
      const s = (p.plan_source ?? "free").split(":")[0]!;
      src[s] = (src[s] ?? 0) + 1;
    });
    const used: Record<string, number> = {};
    (files ?? []).forEach((f) => {
      used[f.user_id] = (used[f.user_id] ?? 0) + Number(f.size);
    });
    const now = Date.now(),
      week = now + 7 * 864e5;
    const name = (p: NonNullable<typeof profs>[number]) => p.org_name || p.display_name || p.id;
    const nearLimit = (profs ?? [])
      .map((p) => {
        const lim = storageBytes(planByKey(p.plan).cap.storage);
        return {
          id: p.id,
          name: name(p),
          pct: isFinite(lim) ? Math.round(((used[p.id] ?? 0) / lim) * 100) : 0,
        };
      })
      .filter((x) => x.pct >= 75)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8);
    const ending = (profs ?? [])
      .flatMap((p) => [
        ...(p.plan_source === "trial" &&
        p.trial_ends_at &&
        +new Date(p.trial_ends_at) > now &&
        +new Date(p.trial_ends_at) < week
          ? [{ id: p.id, name: name(p), what: "Trial", ends: p.trial_ends_at }]
          : []),
        ...(p.voucher_ends_at &&
        +new Date(p.voucher_ends_at) > now &&
        +new Date(p.voucher_ends_at) < week
          ? [{ id: p.id, name: name(p), what: "Voucher benefit", ends: p.voucher_ends_at }]
          : []),
      ])
      .sort((a, b) => a.ends.localeCompare(b.ends));
    const latest = new Map<string, NonNullable<typeof health>[number]>();
    (health ?? []).forEach((h) => {
      if (!latest.has(h.service)) latest.set(h.service, h);
    });
    const aiFail = (ai ?? []).filter((x) => !x.ok).length;
    return {
      daily: Object.values(days),
      sources: Object.entries(src).map(([name, value]) => ({ name, value })),
      nearLimit,
      ending,
      health: [...latest.values()],
      aiFailRate: ai?.length ? Math.round((aiFail / ai.length) * 100) : 0,
    };
  });
