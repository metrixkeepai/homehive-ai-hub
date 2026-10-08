import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { plans } from "@/lib/plans";

type Ctx = { supabase: any; userId: string };

// Every admin function re-checks the role on the server; the page guard is only for display.
async function adminClient(ctx: Ctx) {
  const { data: ok } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!ok) throw new Error("Forbidden: Super Admin access required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(db: any, adminId: string, action: string, target: string | null, reason: string | null, details: object = {}) {
  await db.from("admin_audit_log").insert({ admin_id: adminId, action, target, reason, details });
}

async function allEmails(db: any) {
  const map = new Map<string, { email: string; last: string | null; confirmed: boolean }>();
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    users.forEach((u: any) => map.set(u.id, { email: u.email ?? "", last: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at }));
    if (users.length < 1000) break;
  }
  return map;
}

export const checkSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    return { isSuperAdmin: !!data };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data: profiles } = await db.from("profiles").select("id, account_type, plan, plan_source, trial_ends_at, created_at, suspended");
    const p = profiles ?? [];
    const now = Date.now();
    const d30 = now - 30 * 864e5;
    const byType = { individual: 0, business: 0, enterprise: 0 } as Record<string, number>;
    const byPlan: Record<string, number> = {};
    let paid = 0, trials = 0, suspended = 0, new30 = 0, mrr = 0;
    for (const r of p) {
      byType[r.account_type] = (byType[r.account_type] ?? 0) + 1;
      byPlan[r.plan] = (byPlan[r.plan] ?? 0) + 1;
      if (r.suspended) suspended++;
      if (new Date(r.created_at).getTime() > d30) new30++;
      if (r.plan_source === "trial" && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > now) trials++;
      if (r.plan_source === "stripe") { paid++; mrr += plans.find((x) => x.key === r.plan)?.monthly ?? 0; }
    }
    const signups: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) signups[new Date(now - i * 864e5).toISOString().slice(0, 10)] = 0;
    p.forEach((r) => { const k = r.created_at.slice(0, 10); if (k in signups) signups[k]!++; });
    const [{ count: records }, { count: files }, { count: workspaces }, { data: vouchers }] = await Promise.all([
      db.from("home_items").select("id", { count: "exact", head: true }),
      db.from("evidence_files").select("id", { count: "exact", head: true }),
      db.from("workspaces").select("id", { count: "exact", head: true }),
      db.from("vouchers").select("uses, active"),
    ]);
    const { data: recent } = await db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(8);
    return {
      total: p.length, byType, byPlan, paid, trials, suspended, new30, mrr,
      signups: Object.entries(signups).map(([day, count]) => ({ day: day.slice(5), count })),
      records: records ?? 0, files: files ?? 0, workspaces: workspaces ?? 0,
      voucherRedemptions: (vouchers ?? []).reduce((s: number, v: any) => s + v.uses, 0),
      activeVouchers: (vouchers ?? []).filter((v: any) => v.active).length,
      recent: recent ?? [],
    };
  });

export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ type: z.string().optional(), q: z.string().max(200).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    let query = db.from("profiles").select("id, display_name, account_type, org_name, plan, plan_source, trial_ends_at, created_at, suspended").order("created_at", { ascending: false }).limit(1000);
    if (data.type && data.type !== "all") query = query.eq("account_type", data.type);
    const [{ data: rows }, emails] = await Promise.all([query, allEmails(db)]);
    const q = (data.q ?? "").toLowerCase();
    return (rows ?? []).map((r: any) => ({ ...r, email: emails.get(r.id)?.email ?? "", last_sign_in: emails.get(r.id)?.last ?? null }))
      .filter((r: any) => !q || [r.email, r.display_name, r.org_name].some((v) => (v ?? "").toLowerCase().includes(q)));
  });

export const getSubscriber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: profile }, { data: user }, { count: records }, { count: files }, { data: workspaces }, { data: history }] = await Promise.all([
      db.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      db.auth.admin.getUserById(data.id),
      db.from("home_items").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      db.from("evidence_files").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      db.from("workspaces").select("id, name, type, created_at").eq("owner_id", data.id),
      db.from("admin_audit_log").select("*").eq("target", data.id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (!profile) throw new Error("Account not found");
    const u = user?.user;
    return { profile, email: u?.email ?? "", lastSignIn: u?.last_sign_in_at ?? null, confirmed: !!u?.email_confirmed_at, provider: u?.app_metadata?.provider ?? "email", records: records ?? 0, files: files ?? 0, workspaces: workspaces ?? [], history: history ?? [] };
  });

const reason = z.string().trim().min(3, "Give a reason").max(500);

export const overridePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), plan: z.enum(plans.map((p) => p.key) as [string, ...string[]]), reason }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: before } = await db.from("profiles").select("plan").eq("id", data.id).single();
    const { error } = await db.from("profiles").update({ plan: data.plan, plan_source: "admin" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "plan_override", data.id, data.reason, { from: before?.plan, to: data.plan });
    return { ok: true };
  });

export const setSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), suspended: z.boolean(), reason }).parse(d))
  .handler(async ({ context, data }) => {
    if (data.id === context.userId) throw new Error("You can't suspend your own admin account");
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("profiles").update({ suspended: data.suspended }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.auth.admin.updateUserById(data.id, { ban_duration: data.suspended ? "876000h" : "none" });
    await audit(db, context.userId, data.suspended ? "account_suspended" : "account_restored", data.id, data.reason);
    return { ok: true };
  });

export const extendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(90), reason }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: p } = await db.from("profiles").select("trial_ends_at").eq("id", data.id).single();
    const base = Math.max(Date.now(), p?.trial_ends_at ? new Date(p.trial_ends_at).getTime() : 0);
    const ends = new Date(base + data.days * 864e5).toISOString();
    const { error } = await db.from("profiles").update({ plan: "business_starter", plan_source: "trial", trial_ends_at: ends }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "trial_extended", data.id, data.reason, { days: data.days, ends });
    return { ok: true };
  });

export const listVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const { data } = await db.from("vouchers").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const createVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{4,32}$/, "Use 4–32 letters, numbers, - or _"),
    plan: z.enum(plans.map((p) => p.key) as [string, ...string[]]),
    max_uses: z.number().int().min(1).max(100000),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("vouchers").insert({ code: data.code, plan: data.plan, max_uses: data.max_uses, active: true });
    if (error) throw new Error(error.code === "23505" ? "That code already exists" : error.message);
    await audit(db, context.userId, "voucher_created", data.code, null, data);
    return { ok: true };
  });

export const toggleVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().max(64), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { error } = await db.from("vouchers").update({ active: data.active }).eq("code", data.code);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, data.active ? "voucher_activated" : "voucher_paused", data.code, null);
    return { ok: true };
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const [{ data }, emails] = await Promise.all([db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300), allEmails(db)]);
    return (data ?? []).map((r: any) => ({ ...r, admin_email: emails.get(r.admin_id)?.email ?? "" }));
  });
