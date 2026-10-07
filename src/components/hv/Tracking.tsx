import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarPlus, ChevronRight, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Item } from "./data";
import { Evidence } from "./Evidence";
import { useStore, toneClass } from "./store";
import { downloadReminder, field, trackingDate, trackingStatus } from "./tracking";

export function TrackingEditor({ section, item, onClose }: { section: string; item?: Item; onClose: () => void }) {
  const warranty = section === "warranties";
  const dateKey = warranty ? "Expiry date" : "Renewal date";
  const keys = ["Provider", warranty ? "Product / asset" : "Category", ...(warranty ? ["Start date"] : []), dateKey, "Reference", "Cost", "Remind me (days before)", "Status", "Notes"];
  const { add, update } = useStore();
  const [title, setTitle] = useState(item?.title ?? "");
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(keys.map((k) => [k, item ? field(item, k) : k === "Remind me (days before)" ? "30" : k === "Status" ? "Active" : ""])));
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !values[dateKey]) { toast.error("Enter a name and a date"); return; }
    if (values["Start date"] && values["Start date"] > values[dateKey]) { toast.error("Expiry must be after the start date"); return; }
    const record: Item = { id: item?.id ?? "", title: title.trim(), subtitle: `${values["Provider"] || (warranty ? "Warranty" : "Renewal")} · ${values[dateKey]}`, fields: keys.map((k) => [k, values[k] ?? ""]) };
    setBusy(true);
    const ok = item ? await update(item.id, record) : await add(section, record);
    setBusy(false);
    if (ok) { toast.success("Saved to your workspace"); onClose(); } else toast.error("Couldn't save. Please try again.");
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogTitle>{item ? "Edit" : "Add"} {warranty ? "warranty" : "renewal"}</DialogTitle><DialogDescription>{warranty ? "Cover details and expiry date." : "Provider details and the next renewal date."}</DialogDescription>
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium sm:col-span-2">Name<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
      {keys.map((k) => <label key={k} className={`text-sm font-medium ${k === "Notes" ? "sm:col-span-2" : ""}`}>{k}
        {k === "Status" ? <select value={values[k] || "Active"} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2"><option>Active</option><option>Archived</option></select>
          : k === "Notes" ? <textarea value={values[k]} maxLength={2000} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
          : <input required={k === dateKey} type={k.includes("date") ? "date" : k.includes("days before") ? "number" : "text"} min={k.includes("days before") ? 0 : undefined} max={k.includes("days before") ? 365 : undefined} maxLength={500} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2" />}
      </label>)}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export function TrackingPage({ section, startOpen = false }: { section: string; startOpen?: boolean }) {
  const { added, current } = useStore();
  const [open, setOpen] = useState(startOpen);
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState("all");
  const warranty = section === "warranties";
  const records = added[section] ?? [];
  const counts = (b: string) => records.filter((i) => trackingStatus(i).bucket === b).length;
  const items = records.filter((i) => (bucket === "all" || trackingStatus(i).bucket === bucket) && `${i.title} ${field(i, "Provider")}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (trackingDate(a)?.getTime() ?? Infinity) - (trackingDate(b)?.getTime() ?? Infinity));
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
    <nav className="text-sm text-muted-foreground"><Link to="/app">Overview</Link> / {warranty ? "Warranties" : "Renewals"}</nav>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-primary">Protection & paperwork · {current.name}</p><h1 className="mt-2 font-display text-4xl">{warranty ? "Warranties" : "Renewals"}</h1><p className="mt-2 text-muted-foreground">{warranty ? "Your cover, its conditions and when it ends." : "Your policies, contracts and subscriptions — next dates, together."}</p></div><Button onClick={() => setOpen(true)}><Plus />Add {warranty ? "warranty" : "renewal"}</Button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["all", "Total", records.length], ["active", "Active", counts("active")], ["soon", "Due within 30 days", counts("soon")], ["overdue", warranty ? "Expired" : "Overdue", counts("overdue")]].map(([b, label, count]) => <Button key={b} variant="outline" onClick={() => setBucket(String(b))} className={`h-auto flex-col items-start gap-1 p-4 ${bucket === b ? "border-primary bg-primary/5" : ""}`}><span className="font-display text-3xl">{count}</span><span className="text-xs text-muted-foreground">{label}</span></Button>)}</div>
    <div className="flex flex-wrap gap-3"><input aria-label="Search tracking records" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or provider" className="min-w-0 flex-1 rounded-md border bg-card px-3 py-2 text-sm" /><select aria-label="Tracking status" value={bucket} onChange={(e) => setBucket(e.target.value)} className="rounded-md border bg-card px-3 py-2 text-sm">{[["all", "All records"], ["active", "Active"], ["soon", "Due soon"], ["overdue", "Overdue / expired"], ["missing", "Date needed"], ["archived", "Archived"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    {items.length === 0 ? <div className="border-y py-14 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl">{records.length ? "No matching records" : warranty ? "No warranties yet" : "No renewals yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{records.length ? "Try a different search or status." : "Your saved records will appear here."}</p><Button className="mt-5" variant="outline" onClick={() => records.length ? (setQuery(""), setBucket("all")) : setOpen(true)}>{records.length ? "Clear filters" : "Add your first record"}</Button></div> : <div className="divide-y border-y">{items.map((item) => { const status = trackingStatus(item); const date = trackingDate(item); return <Link key={item.id} to="/app/$section/$id" params={{ section, id: item.id }} className="flex flex-wrap items-center gap-4 py-5 transition hover:bg-secondary/40"><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{field(item, "Provider") || "No provider"}</p></div><div className="text-right"><p className="text-sm">{date ? format(date, "d MMM yyyy") : "No date"}</p><span className={`mt-1 inline-block rounded px-2 py-1 text-xs ${toneClass(status.tone)}`}>{status.label}</span></div><ChevronRight className="h-4 w-4" /></Link>; })}</div>}
    <p className="text-xs text-muted-foreground">Calendar reminders can be downloaded from each record. Email and push alerts are not enabled.</p>
    {open && <TrackingEditor section={section} onClose={() => setOpen(false)} />}
  </div>;
}

export function TrackingDetail({ section, item }: { section: string; item: Item }) {
  const { remove } = useStore();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const status = trackingStatus(item);
  if (deleted) return <div className="p-8"><h1 className="font-display text-3xl">Record deleted</h1><Button asChild className="mt-4"><Link to="/app/$section" params={{ section }}>Back to {section}</Link></Button></div>;
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
    <nav className="text-sm text-muted-foreground"><Link to="/app">Overview</Link> / <Link to="/app/$section" params={{ section }} className="capitalize">{section}</Link> / {item.title}</nav>
    <div className="border-b pb-6"><span className={`inline-block rounded px-2 py-1 text-xs ${toneClass(status.tone)}`}>{status.label}</span><h1 className="mt-3 font-display text-4xl">{item.title}</h1><p className="mt-2 text-muted-foreground">{field(item, "Provider")}</p><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => setEdit(true)}><Pencil />Edit</Button><Button variant="outline" disabled={!trackingDate(item)} onClick={() => { downloadReminder(item); }}><CalendarPlus />Calendar reminder</Button><Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}><Trash2 />Delete</Button></div></div>
    <dl className="grid gap-5 sm:grid-cols-2">{item.fields.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 break-words font-medium">{v}</dd></div>)}</dl>
    <div className="border-t pt-6"><h2 className="mb-4 font-display text-2xl">Evidence</h2><Evidence itemId={item.id} /></div>
    {edit && <TrackingEditor section={section} item={item} onClose={() => setEdit(false)} />}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogTitle>Delete this record?</DialogTitle><DialogDescription>This permanently removes {item.title}.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}><X />Cancel</Button><Button variant="destructive" onClick={async () => { try { await remove(section, item.id); setDeleted(true); setConfirm(false); toast.success("Record deleted"); await navigate({ to: "/app/$section", params: { section } }); } catch { toast.error("Couldn't delete. Please try again."); } }}><Trash2 />Delete</Button></div></DialogContent></Dialog>
  </div>;
}