import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, type Ctx } from "@/lib/admin.functions";
import { planByKey } from "@/lib/plans";

export const billingKinds = ["overview", "invoices", "payments", "transactions", "outstanding", "failed", "refunds", "credits", "stripe", "reconciliation"] as const;
export type BillingKind = (typeof billingKinds)[number];

async function stripeAll(path: string, key: string, max = 500) {
  const out: any[] = [];
  let after = "";
  while (out.length < max) {
    const r = await fetch(`https://api.stripe.com/v1/${path}${path.includes("?") ? "&" : "?"}limit=100${after ? `&starting_after=${after}` : ""}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Payments provider error (${r.status})`);
    const j: any = await r.json();
    out.push(...(j.data ?? []));
    if (!j.has_more || !j.data?.length) break;
    after = j.data[j.data.length - 1].id;
  }
  return out;
}

const row = (o: any, type: string) => ({
  id: o.id as string, type,
  amount: (o.amount ?? o.total ?? o.amount_due ?? o.amount_paid ?? 0) / 100,
  due: (o.amount_remaining ?? 0) / 100,
  currency: String(o.currency ?? "gbp").toUpperCase(),
  status: String(o.status ?? (o.paid ? "succeeded" : "")),
  customer: String(o.customer_email ?? o.billing_details?.email ?? o.receipt_email ?? o.customer ?? ""),
  created: new Date((o.created ?? 0) * 1000).toISOString(),
  dueDate: o.due_date ? new Date(o.due_date * 1000).toISOString() : null,
  description: String(o.description ?? o.number ?? o.reason ?? ""),
  pdf: (o.invoice_pdf as string | undefined) ?? null,
});

export const billingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ from: z.string().datetime(), to: z.string().datetime(), kind: z.enum(billingKinds) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await adminClient(context as Ctx);
    const { data: profs } = await db.from("profiles").select("id, plan, plan_source, display_name, org_name");
    const paid = (profs ?? []).filter((p) => p.plan_source === "stripe");
    const mrr = paid.reduce((s, p) => s + (planByKey(p.plan).monthly ?? 0), 0);
    const local = { mrr, arr: mrr * 12, activePaid: paid.length };
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) return { connected: false as const, local, rows: [] as ReturnType<typeof row>[], kpis: null, daily: [], statuses: [], recon: null };
    const gte = Math.floor(new Date(data.from).getTime() / 1000), lte = Math.floor(new Date(data.to).getTime() / 1000);
    const c = `created[gte]=${gte}&created[lte]=${lte}`;
    const need = (k: BillingKind[]) => k.includes(data.kind) || data.kind === "overview";
    const [inv, ch, rf, cn, bal, subs] = await Promise.all([
      need(["invoices", "outstanding", "transactions", "reconciliation"]) ? stripeAll(`invoices?${c}`, key) : [],
      need(["payments", "failed", "transactions", "reconciliation"]) ? stripeAll(`charges?${c}`, key) : [],
      need(["refunds", "transactions"]) ? stripeAll(`refunds?${c}`, key) : [],
      data.kind === "credits" || data.kind === "transactions" ? stripeAll(`credit_notes?${c}`, key) : [],
      data.kind === "overview" || data.kind === "stripe" ? fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json() as any) : null,
      data.kind === "reconciliation" || data.kind === "stripe" ? stripeAll("subscriptions?status=active", key) : [],
    ]);
    const I = inv.map((o) => row(o, "invoice")), P = ch.map((o) => row(o, "payment")), R = rf.map((o) => row(o, "refund")), C = cn.map((o) => row(o, "credit"));
    const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
    const now = Date.now();
    const open = I.filter((i) => i.status === "open");
    const pastDue = open.filter((i) => i.dueDate && new Date(i.dueDate).getTime() < now);
    const okP = P.filter((p) => p.status === "succeeded");
    const days: Record<string, { day: string; billed: number; collected: number }> = {};
    I.forEach((i) => { const k = i.created.slice(0, 10); days[k] ??= { day: k, billed: 0, collected: 0 }; days[k].billed += i.amount; });
    okP.forEach((p) => { const k = p.created.slice(0, 10); days[k] ??= { day: k, billed: 0, collected: 0 }; days[k].collected += p.amount; });
    const count = (a: { status: string }[]) => Object.entries(a.reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
    const kpis = {
      billed: sum(I), collected: sum(okP), outstanding: open.reduce((s, i) => s + i.due, 0), pastDue: pastDue.reduce((s, i) => s + i.due, 0),
      invoices: I.length, invoicesPaid: I.filter((i) => i.status === "paid").length, invoicesOpen: open.length,
      failed: P.filter((p) => p.status === "failed").length, refunded: sum(R), credits: sum(C), avgInvoice: I.length ? sum(I) / I.length : 0,
      available: (bal?.available ?? []).map((b: any) => ({ amount: b.amount / 100, currency: String(b.currency).toUpperCase() })),
      pending: (bal?.pending ?? []).map((b: any) => ({ amount: b.amount / 100, currency: String(b.currency).toUpperCase() })),
      activeSubs: subs.length,
    };
    const rows = { overview: [], invoices: I, payments: P, transactions: [...I, ...P, ...R, ...C].sort((a, b) => b.created.localeCompare(a.created)), outstanding: open, failed: P.filter((p) => p.status === "failed"), refunds: R, credits: C, stripe: subs.map((o) => row({ ...o, amount: o.items?.data?.[0]?.price?.unit_amount ?? 0 }, "subscription")), reconciliation: [] }[data.kind];
    const recon = data.kind === "reconciliation" ? {
      dbPaid: paid.length, stripeActive: subs.length,
      paidInvoicesWithoutCharge: I.filter((i) => i.status === "paid" && i.amount > 0).length - okP.length,
      issues: [
        ...(paid.length !== subs.length ? [{ issue: "Card-billed accounts in MatrixKeep don't match active Stripe subscriptions", detail: `${paid.length} in MatrixKeep vs ${subs.length} in Stripe` }] : []),
        ...pastDue.map((i) => ({ issue: "Invoice past due", detail: `${i.description || i.id} · ${i.customer}` })),
        ...P.filter((p) => p.status === "failed").map((p) => ({ issue: "Failed payment", detail: `${p.id} · ${p.customer}` })),
      ],
    } : null;
    return { connected: true as const, local, rows, kpis, daily: Object.values(days).sort((a, b) => a.day.localeCompare(b.day)), statuses: count(data.kind === "payments" || data.kind === "failed" ? P : I), recon };
  });
