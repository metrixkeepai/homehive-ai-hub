import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, audit, type Ctx } from "@/lib/admin.functions";
import { planByKey } from "@/lib/plans";

/** "500 MB" / "10 GB" -> bytes; anything else (Custom) -> Infinity. */
export function storageBytes(label: string) {
  const m = /^([\d.,]+)\s*(MB|GB|TB)$/i.exec(label.trim());
  if (!m) return Infinity;
  const n = Number(m[1]!.replace(/,/g, ""));
  return n * { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[m[2]!.toUpperCase() as "MB"];
}

export function usageStatus(used: number, limit: number) {
  if (!isFinite(limit) || limit <= 0) return "ok" as const;
  const pct = used / limit;
  return pct >= 1
    ? ("over" as const)
    : pct >= 0.9
      ? ("critical" as const)
      : pct >= 0.75
        ? ("warning" as const)
        : ("ok" as const);
}

export const accountUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: profile }, { data: files }, { data: items }, { data: ai }, { data: hist }] =
      await Promise.all([
        db
          .from("profiles")
          .select("plan, plan_source, trial_ends_at, created_at, limit_overrides")
          .eq("id", data.id)
          .maybeSingle(),
        db
          .from("evidence_files")
          .select("id, name, mime, size, created_at, item_id")
          .eq("user_id", data.id)
          .order("created_at", { ascending: false }),
        db.from("home_items").select("id, section, title, created_at").eq("user_id", data.id),
        db
          .from("ai_usage_log")
          .select("feature, cost_usd, input_tokens, output_tokens, created_at")
          .eq("user_id", data.id),
        db
          .from("admin_audit_log")
          .select("action, reason, details, created_at")
          .eq("target", data.id)
          .in("action", ["plan_override", "trial_extend", "limit_override"])
          .order("created_at", { ascending: false }),
      ]);
    if (!profile) throw new Error("Account not found");
    const plan = planByKey(profile.plan);
    const ov = (profile.limit_overrides ?? {}) as Record<string, number>;
    const f = files ?? [],
      it = items ?? [];
    const bytes = f.reduce((s, x) => s + Number(x.size), 0);
    const type = (m: string) =>
      m.startsWith("image/")
        ? "Images"
        : m === "application/pdf"
          ? "PDFs"
          : m.startsWith("video/")
            ? "Videos"
            : "Other";
    const byType: Record<string, { count: number; bytes: number }> = {};
    f.forEach((x) => {
      const k = type(x.mime);
      byType[k] = {
        count: (byType[k]?.count ?? 0) + 1,
        bytes: (byType[k]?.bytes ?? 0) + Number(x.size),
      };
    });
    const bySection: Record<string, number> = {};
    it.forEach((x) => {
      bySection[x.section] = (bySection[x.section] ?? 0) + 1;
    });
    const monthly: Record<string, { month: string; files: number; bytes: number }> = {};
    f.forEach((x) => {
      const k = x.created_at.slice(0, 7);
      monthly[k] ??= { month: k, files: 0, bytes: 0 };
      monthly[k].files++;
      monthly[k].bytes += Number(x.size);
    });
    const titles = new Map(it.map((x) => [x.id, x.title]));
    const limit = (k: "assets" | "docs" | "storage") =>
      ov[k] ?? (k === "storage" ? storageBytes(plan.cap.storage) : plan.limits[k]);
    const meters = [
      { key: "storage", label: "Storage", used: bytes, limit: limit("storage"), unit: "bytes" },
      { key: "docs", label: "Documents", used: f.length, limit: limit("docs"), unit: "count" },
      { key: "assets", label: "Records", used: it.length, limit: limit("assets"), unit: "count" },
    ].map((m) => ({
      ...m,
      overridden: m.key in ov,
      status: usageStatus(m.used, m.limit),
      limit: isFinite(m.limit) ? m.limit : null,
    }));
    // Subscription history built from what we actually know: signup, trial, admin changes, current source.
    const subs = [
      { date: profile.created_at, event: "Account created", plan: "Free", source: "signup" },
      ...(profile.trial_ends_at
        ? [
            {
              date: new Date(new Date(profile.trial_ends_at).getTime() - 14 * 864e5).toISOString(),
              event: "Business Starter trial started",
              plan: "Business Starter",
              source: "trial",
            },
          ]
        : []),
      ...(hist ?? []).map((h) => ({
        date: h.created_at,
        event: h.action.replace(/_/g, " ") + (h.reason ? ` — ${h.reason}` : ""),
        plan:
          h.details &&
          typeof h.details === "object" &&
          !Array.isArray(h.details) &&
          typeof h.details["to"] === "string"
            ? planByKey(h.details["to"]).name
            : "",
        source: "admin",
      })),
      ...(profile.plan_source?.startsWith("voucher:")
        ? [
            {
              date: "",
              event: `Voucher ${profile.plan_source.slice(8)} redeemed`,
              plan: plan.name,
              source: "voucher",
            },
          ]
        : []),
    ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return {
      plan: {
        key: plan.key,
        name: plan.name,
        storage: plan.cap.storage,
        source: profile.plan_source,
      },
      meters,
      overrides: ov,
      byType: Object.entries(byType).map(([name, v]) => ({ name, ...v })),
      bySection: Object.entries(bySection)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
      files: f.map((x) => ({
        id: x.id,
        name: x.name,
        mime: x.mime,
        type: type(x.mime),
        size: Number(x.size),
        created: x.created_at,
        record: titles.get(x.item_id) ?? "—",
      })),
      ai: {
        requests: (ai ?? []).length,
        cost: (ai ?? []).reduce((s, x) => s + Number(x.cost_usd), 0),
      },
      subs,
      stripeConnected: !!process.env["STRIPE_SECRET_KEY"],
    };
  });

export const setLimitOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        key: z.enum(["storage", "docs", "assets"]),
        value: z.number().int().positive().nullable(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: p } = await db
      .from("profiles")
      .select("limit_overrides")
      .eq("id", data.id)
      .single();
    const next = { ...((p?.limit_overrides ?? {}) as Record<string, number>) };
    if (data.value === null) delete next[data.key];
    else next[data.key] = data.value;
    const { error } = await db.from("profiles").update({ limit_overrides: next }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "limit_override", data.id, data.reason, {
      key: data.key,
      value: data.value,
    });
    return { ok: true };
  });
