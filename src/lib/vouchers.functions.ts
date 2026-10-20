import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, audit, type Ctx } from "@/lib/admin.functions";
import { plans } from "@/lib/plans";

export const benefitTypes = [
  ["plan", "Plan upgrade"],
  ["free_period", "Free period on a plan"],
  ["discount_percent", "Percentage discount"],
  ["discount_fixed", "Fixed amount off (£)"],
] as const;

export function voucherState(
  v: {
    active: boolean;
    uses: number;
    max_uses: number;
    valid_from: string | null;
    valid_until: string | null;
  },
  now = Date.now(),
) {
  if (!v.active) return "paused";
  if (v.valid_from && now < new Date(v.valid_from).getTime()) return "scheduled";
  if (v.valid_until && now > new Date(v.valid_until).getTime()) return "expired";
  if (v.uses >= v.max_uses) return "used up";
  return "active";
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(prefix: string, len = 8) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return `${prefix}${prefix ? "-" : ""}${Array.from(b, (x) => alphabet[x % alphabet.length]).join("")}`;
}

export const voucherInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).default(""),
    code_type: z.enum(["shared", "unique"]),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/, "Use 2–32 letters, numbers, - or _"),
    quantity: z.number().int().min(1).max(1000),
    max_uses: z.number().int().min(1).max(100000),
    plan: z.enum(plans.map((p) => p.key) as [string, ...string[]]),
    benefit_type: z.enum(["plan", "free_period", "discount_percent", "discount_fixed"]),
    benefit_value: z.number().positive().max(100000).nullable(),
    duration_months: z.number().int().min(1).max(120).nullable(),
    benefit_ends_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    valid_from: z.string().datetime().nullable(),
    valid_until: z.string().datetime().nullable(),
    audiences: z.array(z.enum(["individual", "business", "enterprise"])),
    assigned_email: z.string().trim().email().nullable(),
    one_per_user: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.benefit_type === "discount_percent" && (!v.benefit_value || v.benefit_value > 100))
      ctx.addIssue({ code: "custom", message: "Enter a discount between 1 and 100%" });
    if (v.benefit_type === "discount_fixed" && !v.benefit_value)
      ctx.addIssue({ code: "custom", message: "Enter the amount off" });
    if (v.benefit_type === "free_period" && !v.duration_months && !v.benefit_ends_on)
      ctx.addIssue({ code: "custom", message: "Choose how long the free period lasts" });
    if (v.valid_from && v.valid_until && v.valid_until <= v.valid_from)
      ctx.addIssue({ code: "custom", message: "Redeem-until must be after redeem-from" });
  });

export const createVouchers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => voucherInput.parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { quantity, code, ...rest } = data;
    const batch =
      data.code_type === "unique" ? `${code}-${Date.now().toString(36).toUpperCase()}` : null;
    const codes =
      data.code_type === "shared"
        ? [code]
        : Array.from({ length: quantity }, () => randomCode(code));
    const rows = codes.map((c) => ({
      ...rest,
      code: c,
      batch,
      active: true,
      max_uses: data.code_type === "unique" ? 1 : data.max_uses,
      one_per_user: data.code_type === "unique" ? true : data.one_per_user,
      created_by: context.userId,
    }));
    const { error } = await db.from("vouchers").insert(rows);
    if (error)
      throw new Error(
        error.code === "23505" ? "That code already exists — choose another" : error.message,
      );
    await audit(db, context.userId, "voucher_created", batch ?? code, null, {
      ...rest,
      count: codes.length,
    });
    return { codes, batch };
  });

export const voucherList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context as Ctx);
    const [{ data: v }, { data: r }] = await Promise.all([
      db.from("vouchers").select("*").order("created_at", { ascending: false }),
      db.from("voucher_redemptions").select("code, created_at, benefit_type"),
    ]);
    const days: Record<string, number> = {};
    (r ?? []).forEach((x) => {
      const k = x.created_at.slice(0, 10);
      days[k] = (days[k] ?? 0) + 1;
    });
    const list = (v ?? []).map((x) => ({ ...x, state: voucherState(x) }));
    const byBenefit: Record<string, number> = {};
    (r ?? []).forEach((x) => {
      byBenefit[x.benefit_type] = (byBenefit[x.benefit_type] ?? 0) + 1;
    });
    return {
      vouchers: list,
      kpis: {
        total: list.length,
        active: list.filter((x) => x.state === "active").length,
        expired: list.filter((x) => x.state === "expired").length,
        redemptions: list.reduce((s, x) => s + x.uses, 0),
        batches: new Set(list.map((x) => x.batch).filter(Boolean)).size,
      },
      daily: Object.entries(days)
        .sort()
        .map(([day, count]) => ({ day, count })),
      byBenefit: Object.entries(byBenefit).map(([name, value]) => ({ name, value })),
    };
  });

export const voucherDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: v } = await db.from("vouchers").select("*").eq("code", data.code).maybeSingle();
    if (!v) throw new Error("Voucher not found");
    const [{ data: r }, { data: siblings }] = await Promise.all([
      db
        .from("voucher_redemptions")
        .select("*")
        .eq("code", v.code)
        .order("created_at", { ascending: false }),
      v.batch
        ? db.from("vouchers").select("code, uses, active").eq("batch", v.batch)
        : Promise.resolve({ data: [] as { code: string; uses: number; active: boolean }[] }),
    ]);
    const ids = [...new Set((r ?? []).map((x) => x.user_id))];
    const { data: profs } = ids.length
      ? await db.from("profiles").select("id, display_name, org_name, account_type").in("id", ids)
      : {
          data: [] as {
            id: string;
            display_name: string | null;
            org_name: string | null;
            account_type: string;
          }[],
        };
    const names = new Map((profs ?? []).map((p) => [p.id, p.org_name || p.display_name || p.id]));
    return {
      voucher: { ...v, state: voucherState(v) },
      redemptions: (r ?? []).map((x) => ({ ...x, account: names.get(x.user_id) ?? x.user_id })),
      batch: siblings ?? [],
    };
  });
