import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, type Ctx } from "@/lib/admin.functions";

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(40), from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { key, from, to } = data;
    const inRange = (q: any) => q.gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(5000);
    const prof = "id, display_name, account_type, org_name, plan, plan_source, trial_ends_at, suspended, created_at";
    let rows: any[] = [];
    if (["subscribers", "individual", "business", "enterprise", "subscriptions"].includes(key)) {
      let q = inRange(db.from("profiles").select(prof));
      if (key === "individual" || key === "business" || key === "enterprise") q = q.eq("account_type", key);
      rows = (await q).data ?? [];
    } else if (key === "trials") {
      rows = ((await inRange(db.from("profiles").select(prof).not("trial_ends_at", "is", null))).data ?? [])
        .map((r: any) => ({ ...r, trial_status: new Date(r.trial_ends_at) > new Date() ? "active" : "ended" }));
    } else if (key === "vouchers") {
      rows = (await db.from("vouchers").select("*").order("created_at", { ascending: false })).data ?? [];
    } else if (key === "ai-usage") {
      rows = (await inRange(db.from("ai_usage_log").select("created_at, feature, model, input_tokens, output_tokens, cost_usd, latency_ms, ok, error"))).data ?? [];
    } else if (key === "ai-cost") {
      const raw = (await inRange(db.from("ai_usage_log").select("created_at, model, cost_usd"))).data ?? [];
      const m = new Map<string, any>();
      raw.forEach((r: any) => { const k = r.created_at.slice(0, 10) + "|" + r.model; const e = m.get(k) ?? { day: r.created_at.slice(0, 10), model: r.model, requests: 0, cost_usd: 0 }; e.requests++; e.cost_usd += Number(r.cost_usd); m.set(k, e); });
      rows = [...m.values()];
    } else if (key === "infrastructure") {
      rows = (await db.from("infra_costs").select("period_month, provider, category, description, amount, currency, source").gte("period_month", from.slice(0, 10)).lte("period_month", to.slice(0, 10)).order("period_month", { ascending: false })).data ?? [];
    } else if (key === "platform-usage") {
      const raw = (await inRange(db.from("home_items").select("section, created_at"))).data ?? [];
      const m: Record<string, number> = {};
      raw.forEach((r: any) => { m[r.section] = (m[r.section] ?? 0) + 1; });
      rows = Object.entries(m).map(([section, records]) => ({ section, records })).sort((a, b) => b.records - a.records);
    } else if (key === "audit") {
      rows = (await inRange(db.from("admin_audit_log").select("created_at, action, target, reason, details"))).data ?? [];
    } else throw new Error("This report needs a provider connection");
    return rows;
  });
