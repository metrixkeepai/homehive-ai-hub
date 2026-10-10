import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toggleVoucher, deleteVoucher } from "@/lib/admin.functions";
import { benefitTypes, createVouchers, voucherList } from "@/lib/vouchers.functions";
import { plans, planByKey } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kpi, PageTitle } from "@/components/hv/AdminKpi";
import { DataTable, downloadCsv } from "@/components/hv/BillingKit";

export const Route = createFileRoute("/super-admin/vouchers")({ component: Vouchers });

const benefitLabel = (k: string) => benefitTypes.find(([x]) => x === k)?.[1] ?? k;
export function benefitSummary(v: any) {
  const plan = planByKey(v.plan).name;
  const len = v.benefit_ends_on ? ` until ${new Date(v.benefit_ends_on).toLocaleDateString("en-GB")}` : v.duration_months ? ` for ${v.duration_months} month${v.duration_months > 1 ? "s" : ""}` : "";
  if (v.benefit_type === "discount_percent") return `${v.benefit_value}% off ${plan}${len}`;
  if (v.benefit_type === "discount_fixed") return `£${v.benefit_value} off ${plan}${len}`;
  if (v.benefit_type === "free_period") return `${plan} free${len}`;
  return `${plan}${len || " (no end date)"}`;
}
const pieColors = ["var(--primary)", "#16a34a", "#f59e0b", "var(--muted-foreground)"];

const blank = { name: "", description: "", code_type: "shared" as "shared" | "unique", code: "", quantity: 10, max_uses: 100, plan: "plus", benefit_type: "plan" as "plan" | "free_period" | "discount_percent" | "discount_fixed", benefit_value: "", validity: "none" as "none" | "months" | "date", duration_months: 3, benefit_ends_on: "", valid_from: "", valid_until: "", audiences: [] as ("individual" | "business" | "enterprise")[], assigned_email: "", one_per_user: true };

function Vouchers() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useServerFn(voucherList), create = useServerFn(createVouchers), toggle = useServerFn(toggleVoucher), remove = useServerFn(deleteVoucher);
  const q = useQuery({ queryKey: ["admin", "vouchers"], queryFn: () => list() });
  const [f, setF] = useState(blank);
  const [step, setStep] = useState<"form" | "review" | null>(null);
  const [made, setMade] = useState<string[] | null>(null);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((x) => ({ ...x, [k]: v }));
  const payload = () => ({
    name: f.name, description: f.description, code_type: f.code_type, code: f.code, quantity: f.quantity, max_uses: f.max_uses, plan: f.plan,
    benefit_type: f.benefit_type, benefit_value: f.benefit_type.startsWith("discount") ? Number(f.benefit_value) || null : null,
    duration_months: f.validity === "months" ? f.duration_months : null, benefit_ends_on: f.validity === "date" && f.benefit_ends_on ? f.benefit_ends_on : null,
    valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null, valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,
    audiences: f.audiences, assigned_email: f.assigned_email || null, one_per_user: f.one_per_user,
  });
  const createM = useMutation({
    mutationFn: () => create({ data: payload() }),
    onSuccess: (r) => { setMade(r.codes); setStep(null); setF(blank); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: Error) => { let m = e.message; try { m = JSON.parse(e.message)[0].message; } catch { /* plain */ } toast.error(m); setStep("form"); },
  });
  const toggleM = useMutation({ mutationFn: (v: { code: string; active: boolean }) => toggle({ data: v }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "vouchers"] }), onError: (e: Error) => toast.error(e.message) });
  const delM = useMutation({ mutationFn: (code: string) => remove({ data: { code } }), onSuccess: () => { toast.success("Voucher deleted"); qc.invalidateQueries({ queryKey: ["admin", "vouchers"] }); }, onError: (e: Error) => toast.error(e.message) });
  const d = q.data;
  const field = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-6">
      <PageTitle title="Voucher engine" sub="Shared or unique codes, validity windows, benefit durations and eligibility."><Button onClick={() => setStep("form")}>Create voucher</Button></PageTitle>
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : q.error || !d ? <div className="space-y-2"><p className="text-destructive">Couldn't reach the server.</p><Button variant="outline" onClick={() => q.refetch()}>Try again</Button></div> : <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Voucher codes" value={d.kpis.total} /><Kpi label="Active" value={d.kpis.active} /><Kpi label="Expired" value={d.kpis.expired} /><Kpi label="Redemptions" value={d.kpis.redemptions} /><Kpi label="Unique-code batches" value={d.kpis.batches} />
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border bg-card p-5 lg:col-span-2"><h2 className="font-semibold">Redemptions per day</h2>{d.daily.length ? <div className="mt-4 h-48"><ResponsiveContainer><BarChart data={d.daily}><XAxis dataKey="day" fontSize={10} /><YAxis allowDecimals={false} fontSize={10} /><Tooltip /><Bar dataKey="count" fill="var(--primary)" /></BarChart></ResponsiveContainer></div> : <p className="mt-2 text-sm text-muted-foreground">No redemptions recorded yet.</p>}</section>
          <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">By benefit type</h2>{d.byBenefit.length ? <div className="mt-4 h-48"><ResponsiveContainer><PieChart><Pie data={d.byBenefit.map((x) => ({ ...x, name: benefitLabel(x.name) }))} dataKey="value" nameKey="name" outerRadius={70}>{d.byBenefit.map((_, i) => <Cell key={i} fill={pieColors[i % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>}</section>
        </div>
        <DataTable name="vouchers" rows={d.vouchers.map((v) => ({ ...v, benefit: benefitSummary(v), kind: v.code_type, audience: v.audiences.length ? v.audiences.join(", ") : "everyone" }))}
          onOpen={(r) => nav({ to: "/super-admin/vouchers/$code", params: { code: r.code } })}
          filters={[{ key: "state", label: "States" }, { key: "kind", label: "Code types" }, { key: "benefit_type", label: "Benefits" }]}
          cols={[{ key: "code", label: "Code", render: (r) => <span className="font-mono">{r.code}</span> }, { key: "name", label: "Name" }, { key: "benefit", label: "Benefit" }, { key: "audience", label: "Who" }, { key: "uses", label: "Used", render: (r) => `${r.uses} / ${r.max_uses}` }, { key: "valid_until", label: "Redeem by", render: (r) => r.valid_until ? new Date(r.valid_until).toLocaleDateString("en-GB") : "—" }, { key: "state", label: "State", render: (r) => <span className="capitalize">{r.state}</span> },
            { key: "active", label: "On", render: (r) => <span onClick={(e) => e.stopPropagation()}><Switch checked={r.active} onCheckedChange={(a) => toggleM.mutate({ code: r.code, active: a })} aria-label={`Toggle ${r.code}`} /></span> },
            { key: "del", label: "", render: (r) => <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${r.code}?`)) delM.mutate(r.code); }} className="text-xs text-destructive">Delete</button> }]} />
      </>}

      <Dialog open={step !== null} onOpenChange={(o) => !o && setStep(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{step === "review" ? "Review voucher" : "Create voucher"}</DialogTitle></DialogHeader>
          {step === "form" ? (
            <form className="grid gap-3 text-sm sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setStep("review"); }}>
              <label className="sm:col-span-2">Name<Input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Spring launch offer" /></label>
              <label className="sm:col-span-2">Description<Input value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
              <label>Code type<select className={field} value={f.code_type} onChange={(e) => set("code_type", e.target.value as any)}><option value="shared">One shared code</option><option value="unique">Many unique single-use codes</option></select></label>
              <label>{f.code_type === "shared" ? "Code" : "Code prefix"}<Input required value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder={f.code_type === "shared" ? "SPRING2027" : "SPRING"} /></label>
              {f.code_type === "unique" ? <label>Number of codes<Input type="number" min={1} max={1000} value={f.quantity} onChange={(e) => set("quantity", Number(e.target.value))} /></label>
                : <label>Total redemptions allowed<Input type="number" min={1} value={f.max_uses} onChange={(e) => set("max_uses", Number(e.target.value))} /></label>}
              {f.code_type === "shared" && <label className="flex items-center gap-2 self-end pb-2"><Switch checked={f.one_per_user} onCheckedChange={(v) => set("one_per_user", v)} />Once per account</label>}
              <label>Benefit<select className={field} value={f.benefit_type} onChange={(e) => set("benefit_type", e.target.value as any)}>{benefitTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Plan<select className={field} value={f.plan} onChange={(e) => set("plan", e.target.value)}>{plans.filter((p) => p.monthly !== null && p.key !== "free").map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
              {f.benefit_type.startsWith("discount") && <label>{f.benefit_type === "discount_percent" ? "Discount %" : "Amount off (£)"}<Input type="number" min={1} value={f.benefit_value} onChange={(e) => set("benefit_value", e.target.value)} /></label>}
              <label>Benefit lasts<select className={field} value={f.validity} onChange={(e) => set("validity", e.target.value as any)}><option value="none">No end date</option><option value="months">Months from redemption</option><option value="date">Until a fixed date</option></select></label>
              {f.validity === "months" && <label>Months<Input type="number" min={1} max={120} value={f.duration_months} onChange={(e) => set("duration_months", Number(e.target.value))} /></label>}
              {f.validity === "date" && <label>Benefit ends on<Input type="date" value={f.benefit_ends_on} onChange={(e) => set("benefit_ends_on", e.target.value)} /></label>}
              <label>Redeem from (optional)<Input type="datetime-local" value={f.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></label>
              <label>Redeem until (optional)<Input type="datetime-local" value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></label>
              <fieldset className="sm:col-span-2"><legend>Who can redeem (none ticked = everyone)</legend><div className="mt-1 flex gap-4">{(["individual", "business", "enterprise"] as const).map((a) => <label key={a} className="flex items-center gap-1 capitalize"><input type="checkbox" checked={f.audiences.includes(a)} onChange={(e) => set("audiences", e.target.checked ? [...f.audiences, a] : f.audiences.filter((x) => x !== a))} />{a}</label>)}</div></fieldset>
              <label className="sm:col-span-2">Assign to one email (optional)<Input type="email" value={f.assigned_email} onChange={(e) => set("assigned_email", e.target.value)} placeholder="customer@example.com" /></label>
              {f.benefit_type.startsWith("discount") && <p className="text-xs text-muted-foreground sm:col-span-2">Discounts are recorded on redemption and applied to card billing once Stripe is connected. They don't change the customer's plan.</p>}
              <div className="sm:col-span-2"><Button type="submit">Review</Button></div>
            </form>
          ) : step === "review" ? (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-2">{[["Name", f.name], ["Codes", f.code_type === "shared" ? `${f.code} (shared, ${f.max_uses} uses${f.one_per_user ? ", once per account" : ""})` : `${f.quantity} unique codes starting ${f.code}-`], ["Benefit", benefitSummary({ ...payload(), plan: f.plan })], ["Redeemable", `${f.valid_from ? new Date(f.valid_from).toLocaleString("en-GB") : "now"} → ${f.valid_until ? new Date(f.valid_until).toLocaleString("en-GB") : "no end"}`], ["Who", f.audiences.length ? f.audiences.join(", ") : "Everyone"], ["Assigned to", f.assigned_email || "—"]].map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setStep("form")}>Back</Button><Button disabled={createM.isPending} onClick={() => createM.mutate()}>{createM.isPending ? "Creating…" : "Create"}</Button></div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!made} onOpenChange={(o) => !o && setMade(null)}>
        <DialogContent><DialogHeader><DialogTitle>{made?.length === 1 ? "Voucher created" : `${made?.length} vouchers created`}</DialogTitle></DialogHeader>
          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted p-3 font-mono text-sm">{made?.map((c) => <div key={c}>{c}</div>)}</div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => { navigator.clipboard.writeText(made!.join("\n")); toast.success("Copied"); }}>Copy</Button><Button variant="outline" onClick={() => downloadCsv("voucher-codes", made!.map((code) => ({ code })))}>Download CSV</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
