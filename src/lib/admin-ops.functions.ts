import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, audit, type Ctx } from "@/lib/admin.functions";
import type { Json } from "@/integrations/supabase/types";
import { plans } from "@/lib/plans";

const Range = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const env = (k: string) => !!process.env[k];

import { PaymentRecord, PaymentResponse } from "./stripe-read-schema";
/* ---------------- Stripe deployment account ---------------- */
async function stripe(path: string) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments provider is not configured");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Payments provider error (${r.status})`);
  return PaymentResponse.parse(await r.json());
}

export const paymentsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Range.extend({
      kind: z.enum(["overview", "payments", "invoices", "outstanding", "refunds", "subscriptions"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await adminClient(context as Ctx);
    if (!env("STRIPE_SECRET_KEY"))
      return { connected: false as const, kind: "disconnected" as const };
    const gte = Math.floor(new Date(data.from).getTime() / 1000),
      lte = Math.floor(new Date(data.to).getTime() / 1000);
    const created = `created[gte]=${gte}&created[lte]=${lte}`;
    const map = (o: z.infer<typeof PaymentRecord>) => ({
      id: o.id,
      amount: (o.amount ?? o.amount_due ?? o.amount_paid ?? 0) / 100,
      currency: (o.currency ?? "gbp").toUpperCase(),
      status: o.status,
      customer: o.customer_email ?? o.billing_details?.email ?? o.customer ?? "",
      created: new Date(o.created * 1000).toISOString(),
      description: o.description ?? o.number ?? "",
    });
    if (data.kind === "overview") {
      const [bal, ch, rf, inv] = await Promise.all([
        stripe("balance"),
        stripe(`charges?limit=100&${created}`),
        stripe(`refunds?limit=100&${created}`),
        stripe(`invoices?limit=100&status=open`),
      ]);
      const sum = (a: z.infer<typeof PaymentRecord>[]) =>
        a.reduce((s, x) => s + (x.amount ?? 0), 0) / 100;
      const paid = ch.data.filter((c) => c.paid && !c.refunded);
      const days: Record<string, number> = {};
      paid.forEach((c) => {
        const k = new Date(c.created * 1000).toISOString().slice(0, 10);
        days[k] = (days[k] ?? 0) + (c.amount ?? 0) / 100;
      });
      return {
        connected: true as const,
        kind: "overview" as const,
        available: bal.available.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
        pending: bal.pending.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
        gross: sum(paid),
        refunded: sum(rf.data),
        failed: ch.data.filter((c) => c.status === "failed").length,
        outstanding: inv.data.reduce((s, i) => s + (i.amount_remaining ?? 0), 0) / 100,
        outstandingCount: inv.data.length,
        daily: Object.entries(days)
          .sort()
          .map(([day, amount]) => ({ day, amount })),
      };
    }
    const path = {
      payments: `charges?limit=100&${created}`,
      invoices: `invoices?limit=100&${created}`,
      outstanding: "invoices?limit=100&status=open",
      refunds: `refunds?limit=100&${created}`,
      subscriptions: "subscriptions?limit=100&status=all",
    }[data.kind];
    const res = await stripe(path);
    return { connected: true as const, kind: "rows" as const, rows: res.data.map(map) };
  });

/* ---------------- Revenue (subscription state from our own database) ---------------- */
export const revenueData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data } = await db.from("profiles").select("plan, plan_source, account_type");
    const rows = plans.map((p) => {
      const on = (data ?? []).filter((r) => r.plan === p.key);
      const billed = on.filter((r) => r.plan_source === "stripe").length;
      return {
        key: p.key,
        name: p.name,
        audience: p.audience,
        monthly: p.monthly,
        accounts: on.length,
        billed,
        free: on.length - billed,
        mrr: billed * (p.monthly ?? 0),
      };
    });
    const mrr = rows.reduce((s, r) => s + r.mrr, 0);
    return {
      stripeConnected: env("STRIPE_SECRET_KEY"),
      rows,
      mrr,
      arr: mrr * 12,
      billedAccounts: rows.reduce((s, r) => s + r.billed, 0),
    };
  });

/* ---------------- AI usage & cost ---------------- */
export const aiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Range.parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: logs }, { data: rates }, { data: profiles }] = await Promise.all([
      db
        .from("ai_usage_log")
        .select("*")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .order("created_at", { ascending: false })
        .limit(5000),
      db.from("ai_model_rates").select("*"),
      db.from("profiles").select("id, display_name, org_name, plan"),
    ]);
    const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
    const cost = (l: NonNullable<typeof logs>[number]) => Number(l.cost_usd);
    const agg = (key: (l: NonNullable<typeof logs>[number]) => string) => {
      const m: Record<
        string,
        { key: string; calls: number; tokens: number; cost: number; errors: number }
      > = {};
      (logs ?? []).forEach((l) => {
        const k = key(l);
        const e = (m[k] ??= { key: k, calls: 0, tokens: 0, cost: 0, errors: 0 });
        e.calls++;
        e.tokens += l.input_tokens + l.output_tokens;
        e.cost += cost(l);
        if (!l.ok) e.errors++;
      });
      return Object.values(m).sort((a, b) => b.cost - a.cost || b.calls - a.calls);
    };
    const L = logs ?? [];
    return {
      cachedInput: L.reduce(
        (n, l) => n + Number((l.usage_details as { cached_tokens?: number })?.cached_tokens ?? 0),
        0,
      ),
      cacheSavings: L.reduce(
        (n, l) =>
          n + Number((l.usage_details as { cache_savings_usd?: number })?.cache_savings_usd ?? 0),
        0,
      ),
      measuredCalls: L.filter(
        (l) => (l.usage_details as { accounting_version?: number })?.accounting_version === 1,
      ).length,
      speechMinutes: L.reduce((n, l) => n + Number(l.audio_seconds ?? 0), 0) / 60,
      calls: L.length,
      errors: L.filter((l) => !l.ok).length,
      inputTokens: L.reduce((s, l) => s + l.input_tokens, 0),
      outputTokens: L.reduce((s, l) => s + l.output_tokens, 0),
      cost: L.reduce((s, l) => s + cost(l), 0),
      avgLatency: L.length
        ? Math.round(L.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / L.length)
        : 0,
      byFeature: agg((l) => l.feature),
      byModel: agg((l) => l.model),
      byPlan: agg((l) => prof.get(l.user_id ?? "")?.plan ?? "unknown"),
      byCustomer: agg((l) => l.user_id ?? "unknown")
        .slice(0, 50)
        .map((r) => ({
          ...r,
          name: prof.get(r.key)?.org_name || prof.get(r.key)?.display_name || "Unknown",
        })),
      byDay: agg((l) => l.created_at.slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key)),
      recent: L.slice(0, 100).map((l) => ({ ...l, cost: cost(l) })),
      rates: rates ?? [],
      models: [...new Set(L.map((l) => l.model).concat((rates ?? []).map((r) => r.model)))],
    };
  });

export const setAiRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        model: z.string().min(1).max(100),
        input: z.number().min(0).max(10000),
        output: z.number().min(0).max(10000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("ai_model_rates").upsert({
      model: data.model,
      input_per_million_usd: data.input,
      output_per_million_usd: data.output,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ai_rate_set", data.model, null, data);
    return { ok: true };
  });

/* ---------------- Infrastructure costs ---------------- */
export const infraCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data } = await db
      .from("infra_costs")
      .select("*")
      .order("period_month", { ascending: false })
      .limit(1000);
    return {
      rows: data ?? [],
      providers: [
        {
          key: "aws",
          name: "AWS",
          connected: env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY"),
          needs: "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (Cost Explorer read access)",
        },
        {
          key: "azure",
          name: "Azure",
          connected: env("AZURE_TENANT_ID") && env("AZURE_CLIENT_ID") && env("AZURE_CLIENT_SECRET"),
          needs: "AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (Cost Management Reader)",
        },
        {
          key: "lovable",
          name: "Lovable Cloud hosting",
          connected: false,
          needs: "Enter monthly invoice amounts manually",
        },
      ],
    };
  });

export const addInfraCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: z.string().min(1).max(60),
        category: z.string().min(1).max(60),
        description: z.string().max(300),
        amount: z.number().min(0).max(10_000_000),
        currency: z.enum(["GBP", "USD", "EUR"]),
        period_month: z.string().regex(/^\d{4}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db
      .from("infra_costs")
      .insert({ ...data, period_month: `${data.period_month}-01`, created_by: context.userId });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "infra_cost_added", data.provider, null, data);
    return { ok: true };
  });

export const deleteInfraCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("infra_costs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "infra_cost_removed", data.id, null);
    return { ok: true };
  });

/* ---------------- Plans & versions ---------------- */
export const planVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    let q = db.from("plan_versions").select("*").order("version", { ascending: false });
    if (data.key) q = q.eq("plan_key", data.key);
    const [{ data: versions }, { data: profiles }, { data: st }] = await Promise.all([
      q,
      db.from("profiles").select("plan"),
      db.from("plan_status").select("plan_key, active"),
    ]);
    const counts: Record<string, number> = {};
    (profiles ?? []).forEach((p) => {
      counts[p.plan] = (counts[p.plan] ?? 0) + 1;
    });
    const inactive = (st ?? []).filter((s) => !s.active).map((s) => s.plan_key);
    return { versions: versions ?? [], counts, inactive };
  });

export const savePlanVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        plan_key: z.string().regex(/^[a-z0-9_]{2,40}$/, "Key: lowercase letters, numbers, _"),
        name: z.string().min(2).max(60),
        audience: z.enum(["individual", "business", "enterprise"]),
        monthly: z.number().min(0).max(100000).nullable(),
        yearly: z.number().min(0).max(1000000).nullable(),
        capacity: z.record(z.string(), z.string().max(60)),
        benefits: z.array(z.string().max(200)).max(30),
        notes: z.string().max(500).optional(),
        entitlements: z
          .record(
            z.string().max(60),
            z.object({
              on: z.boolean(),
              limit: z.number().min(0).max(1e9).nullable().optional(),
              unit: z.enum(["count", "MB", "GB", "TB", "per month"]).optional(),
            }),
          )
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: last } = await db
      .from("plan_versions")
      .select("version")
      .eq("plan_key", data.plan_key)
      .order("version", { ascending: false })
      .limit(1);
    const version = (last?.[0]?.version ?? 0) + 1;
    const { error } = await db.from("plan_versions").insert({
      ...data,
      entitlements: (data.entitlements ?? null) as Json,
      notes: data.notes ?? null,
      version,
      status: "draft",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "plan_version_saved", data.plan_key, data.notes ?? null, {
      version,
    });
    return { version };
  });

export const setPlanVersionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "archived", "draft"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: v } = await db
      .from("plan_versions")
      .select("plan_key, version")
      .eq("id", data.id)
      .single();
    if (!v) throw new Error("Version not found");
    if (data.status === "approved") {
      const { publishPlanVersion } = await import("./billing-catalogue.server");
      await publishPlanVersion(data.id, context.userId);
      return { ok: true };
    }
    const { error } = await db
      .from("plan_versions")
      .update({ status: data.status })
      .neq("status", "approved")
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(db, context.userId, `plan_version_${data.status}`, v.plan_key, null, {
      version: v.version,
    });
    return { ok: true };
  });

export const setPlanActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.string().max(60), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("plan_status").upsert({
      plan_key: data.key,
      active: data.active,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit(
      db,
      context.userId,
      data.active ? "plan_activated" : "plan_deactivated",
      data.key,
      null,
    );
    return { ok: true };
  });

/** Archive: hide the plan from new customers while retaining the published entitlements. */
export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    if (data.key === "free")
      throw new Error("The Free plan can't be archived — new accounts start on it.");
    const { error } = await db.from("plan_status").upsert({
      plan_key: data.key,
      active: false,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "plan_archived", data.key, null);
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { plans } = await import("@/lib/plans");
    if (plans.some((p) => p.key === data.key))
      throw new Error(
        "This plan is tied to card payments and can't be deleted — deactivate or archive it instead.",
      );
    const [acc, subs, red, vou, history] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).eq("plan", data.key),
      db
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .like("price_id", `${data.key}\\_%`),
      db
        .from("voucher_redemptions")
        .select("id", { count: "exact", head: true })
        .or(`plan_after.eq.${data.key},plan_before.eq.${data.key}`),
      db.from("vouchers").select("code", { count: "exact", head: true }).eq("plan", data.key),
      db
        .from("billing_price_history")
        .select("price_id", { count: "exact", head: true })
        .eq("plan_key", data.key),
    ]);
    if ([acc, subs, red, vou, history].some((result) => result.error))
      throw new Error("Could not verify plan dependencies.");
    const deps = [
      [history.count, "Stripe price mappings"],
      [acc.count, "accounts on it"],
      [subs.count, "subscription/billing records"],
      [red.count, "voucher redemptions"],
      [vou.count, "vouchers granting it"],
    ].filter(([n]) => n) as [number, string][];
    if (deps.length)
      throw new Error(
        `Can't delete safely: ${deps.map(([n, l]) => `${n} ${l}`).join(", ")}. Deactivate or archive it instead.`,
      );
    await db.from("plan_versions").delete().eq("plan_key", data.key);
    await db.from("plan_status").delete().eq("plan_key", data.key);
    await audit(db, context.userId, "plan_deleted", data.key, null);
    return { ok: true };
  });

/* ---------------- Feature flags ---------------- */
export const listFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data } = await db.from("feature_flags").select("*").order("key");
    return data ?? [];
  });

export const saveFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().regex(/^[a-z0-9_.-]{2,60}$/, "Key: lowercase letters, numbers, . _ -"),
        name: z.string().min(2).max(80),
        description: z.string().max(300),
        enabled: z.boolean(),
        audiences: z.array(z.enum(["individual", "business", "enterprise"])),
        rollout: z.number().int().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db
      .from("feature_flags")
      .upsert({ ...data, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, data.enabled ? "flag_on" : "flag_off", data.key, null, data);
    return { ok: true };
  });

export const deleteFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    await db.from("feature_flags").delete().eq("key", data.key);
    await audit(db, context.userId, "flag_deleted", data.key, null);
    return { ok: true };
  });

/* ---------------- Integrations ---------------- */
const PROVIDERS = [
  {
    key: "openai",
    name: "OpenAI (Sera & Add anything)",
    needs: ["OPENAI_API_KEY"],
    category: "AI",
  },
  {
    key: "database",
    name: "Database & auth",
    needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    category: "Platform",
  },
  {
    key: "storage",
    name: "Evidence file storage",
    needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    category: "Platform",
  },
  {
    key: "stripe",
    name: "Stripe card payments",
    needs: ["STRIPE_SECRET_KEY"],
    category: "Payments",
  },
  {
    key: "aws",
    name: "AWS cost explorer",
    needs: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    category: "Infrastructure",
  },
  {
    key: "azure",
    name: "Azure cost management",
    needs: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"],
    category: "Infrastructure",
  },
  { key: "email", name: "Transactional email", needs: ["RESEND_API_KEY"], category: "Messaging" },
] as const;

async function probe(key: string): Promise<{ ok: boolean; ms: number; detail: string }> {
  const t = Date.now();
  try {
    if (key === "database") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("profiles")
        .select("id", { head: true, count: "exact" });
      return { ok: !error, ms: Date.now() - t, detail: error?.message ?? "Query OK" };
    }
    if (key === "auth") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      return { ok: !error, ms: Date.now() - t, detail: error?.message ?? "Auth OK" };
    }
    if (key === "storage") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.storage.from("evidence").list("", { limit: 1 });
      return { ok: !error, ms: Date.now() - t, detail: error?.message ?? "Bucket reachable" };
    }
    if (key === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${process.env["OPENAI_API_KEY"] ?? ""}`,
        },
      });
      return {
        ok: r.ok,
        ms: Date.now() - t,
        detail: `HTTP ${r.status}`,
      };
    }
    if (key === "stripe") {
      if (!env("STRIPE_SECRET_KEY")) return { ok: false, ms: 0, detail: "Setup required" };
      await stripe("balance");
      return { ok: true, ms: Date.now() - t, detail: "Balance readable" };
    }
    return { ok: false, ms: 0, detail: "Setup required — no live check available until connected" };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, detail: (e as Error).message };
  }
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data } = await db.from("provider_connections").select("*");
    const saved = new Map((data ?? []).map((r) => [r.provider, r]));
    return PROVIDERS.map((p) => {
      const missing = p.needs.filter((n) => !env(n));
      const s = saved.get(p.key);
      return {
        ...p,
        needs: [...p.needs],
        missing,
        status: missing.length
          ? "setup_required"
          : s?.last_result === "fail"
            ? "failing"
            : "connected",
        notes: s?.notes ?? "",
        lastChecked: s?.last_checked_at ?? null,
        lastDetail: s?.last_result ?? null,
      };
    });
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.string().max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const r = await probe(data.provider);
    await db.from("provider_connections").upsert({
      provider: data.provider,
      last_checked_at: new Date().toISOString(),
      last_result: r.ok ? "ok" : "fail",
      notes: r.detail,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    return r;
  });

/* ---------------- Health ---------------- */
export const runHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const services = [
      "database",
      "auth",
      "storage",
      "openai",
      ...(env("STRIPE_SECRET_KEY") ? ["stripe"] : []),
    ];
    const results = await Promise.all(
      services.map(async (s) => ({ service: s, ...(await probe(s)) })),
    );
    await db
      .from("health_checks")
      .insert(
        results.map((r) => ({ service: r.service, ok: r.ok, latency_ms: r.ms, detail: r.detail })),
      );
    return results;
  });

export const healthHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Range.parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: rows }, { data: ai }] = await Promise.all([
      db
        .from("health_checks")
        .select("*")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .order("created_at", { ascending: false })
        .limit(2000),
      db
        .from("ai_usage_log")
        .select("ok, latency_ms, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(5000),
    ]);
    const by: Record<
      string,
      {
        service: string;
        checks: number;
        ok: number;
        avgMs: number;
        last: NonNullable<typeof rows>[number];
      }
    > = {};
    (rows ?? []).forEach((r) => {
      const e = (by[r.service] ??= { service: r.service, checks: 0, ok: 0, avgMs: 0, last: r });
      e.checks++;
      if (r.ok) e.ok++;
      e.avgMs += r.latency_ms ?? 0;
    });
    Object.values(by).forEach((e) => {
      e.avgMs = Math.round(e.avgMs / e.checks);
    });
    const A = ai ?? [];
    return {
      services: Object.values(by),
      history: (rows ?? []).slice(0, 200),
      aiErrorRate: A.length ? A.filter((a) => !a.ok).length / A.length : 0,
      aiCalls: A.length,
    };
  });

/* ---------------- API usage ---------------- */
export const apiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Range.parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: ai }, { data: items }, { data: files }] = await Promise.all([
      db
        .from("ai_usage_log")
        .select("feature, ok, latency_ms, created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(10000),
      db
        .from("home_items")
        .select("created_at, section")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(10000),
      db
        .from("evidence_files")
        .select("created_at, size")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(10000),
    ]);
    const days: Record<string, { day: string; ai: number; records: number; uploads: number }> = {};
    const d = (s: string) =>
      (days[s.slice(0, 10)] ??= { day: s.slice(0, 10), ai: 0, records: 0, uploads: 0 });
    (ai ?? []).forEach((r) => d(r.created_at).ai++);
    (items ?? []).forEach((r) => d(r.created_at).records++);
    (files ?? []).forEach((r) => d(r.created_at).uploads++);
    const sections: Record<string, number> = {};
    (items ?? []).forEach((r) => {
      sections[r.section] = (sections[r.section] ?? 0) + 1;
    });
    return {
      aiCalls: (ai ?? []).length,
      aiErrors: (ai ?? []).filter((r) => !r.ok).length,
      records: (items ?? []).length,
      uploads: (files ?? []).length,
      uploadBytes: (files ?? []).reduce((s, f) => s + Number(f.size), 0),
      daily: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)),
      sections: Object.entries(sections)
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
