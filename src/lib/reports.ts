// Shared report catalogue (client-safe). Reports with `needs` show Setup Required instead of figures.
export type ReportDef = { key: string; title: string; desc: string; needs?: string[] };

export const reports: ReportDef[] = [
  { key: "subscribers", title: "Subscriber Reports", desc: "Every account created in the period." },
  {
    key: "individual",
    title: "Individual User Reports",
    desc: "Home accounts created in the period.",
  },
  { key: "business", title: "Business Reports", desc: "Business accounts created in the period." },
  {
    key: "enterprise",
    title: "Enterprise Reports",
    desc: "Large organisation accounts created in the period.",
  },
  {
    key: "subscriptions",
    title: "Subscription Reports",
    desc: "Accounts by plan and how the plan was set.",
  },
  { key: "trials", title: "Trial Reports", desc: "Business Starter trials, active and ended." },
  { key: "vouchers", title: "Voucher Reports", desc: "Voucher codes and how often each was used." },
  {
    key: "ai-usage",
    title: "AI Usage Reports",
    desc: "Every AI request: feature, model, tokens, speed.",
  },
  { key: "ai-cost", title: "AI Cost Reports", desc: "AI spend per day and model." },
  {
    key: "infrastructure",
    title: "Infrastructure Cost Reports",
    desc: "Hosting and service bills entered or imported.",
  },
  { key: "platform-usage", title: "Platform Usage Reports", desc: "Records saved per section." },
  { key: "audit", title: "Audit Reports", desc: "Every Super Admin action with reason." },
  { key: "revenue", title: "Revenue Reports", desc: "Paid revenue by month.", needs: ["Stripe"] },
  {
    key: "payments",
    title: "Payment Reports",
    desc: "Successful and failed payments.",
    needs: ["Stripe"],
  },
  {
    key: "outstanding",
    title: "Outstanding / Due Reports",
    desc: "Unpaid and overdue invoices.",
    needs: ["Stripe"],
  },
  { key: "refunds", title: "Refund Reports", desc: "Refunds and disputes.", needs: ["Stripe"] },
  {
    key: "churn",
    title: "Churn Reports",
    desc: "Cancelled paid subscriptions.",
    needs: ["Stripe"],
  },
];

export const findReport = (k: string) => reports.find((r) => r.key === k);

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
