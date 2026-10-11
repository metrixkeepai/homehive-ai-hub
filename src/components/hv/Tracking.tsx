import { useRecordLinks, RelatedRecords } from "@/components/hv/RecordLinks";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarClock, CalendarPlus, ChevronRight, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { ViewToggle, useViewMode } from "./ViewToggle";
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
  const [view, setView] = useViewMode(section);
  const warranty = section === "warranties";
  const records = added[section] ?? [];
  const counts = (b: string) => records.filter((i) => trackingStatus(i).bucket === b).length;
  const items = records.filter((i) => (bucket === "all" || trackingStatus(i).bucket === bucket) && `${i.title} ${field(i, "Provider")}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (trackingDate(a)?.getTime() ?? Infinity) - (trackingDate(b)?.getTime() ?? Infinity));
  const Icon = warranty ? ShieldCheck : CalendarClock;
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
    <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Home</Link> / <span className="text-foreground">{warranty ? "Warranties" : "Renewals"}</span></nav>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="flex items-center gap-3 font-display text-4xl"><Icon className="h-7 w-7 text-primary" />{warranty ? "Warranties" : "Renewals"}</h1><p className="mt-2 text-muted-foreground">{warranty ? "Your cover, its conditions and when it ends." : "Your policies, contracts and subscriptions — next dates, together."} <span className="text-xs">· {current.name}</span></p></div><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />Add {warranty ? "warranty" : "renewal"}</button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["all", "Total", records.length], ["active", "Active", counts("active")], ["soon", "Due within 30 days", counts("soon")], ["overdue", warranty ? "Expired" : "Overdue", counts("overdue")]].map(([b, label, count]) => <button key={b} onClick={() => setBucket(String(b))} className={`rounded-2xl border bg-card p-4 text-left shadow-soft transition hover:border-primary ${bucket === b ? "border-primary ring-2 ring-primary/20" : ""}`}><p className="font-display text-2xl">{count}</p><p className="text-sm text-muted-foreground">{label}</p></button>)}</div>
    <div className="flex flex-wrap items-center gap-3"><input aria-label="Search tracking records" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Filter ${warranty ? "warranties" : "renewals"}…`} className="min-w-0 flex-1 rounded-full border bg-card px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" /><select aria-label="Tracking status" value={bucket} onChange={(e) => setBucket(e.target.value)} className="rounded-full border bg-card px-4 py-2.5 text-sm">{[["all", "All records"], ["active", "Active"], ["soon", "Due soon"], ["overdue", "Overdue / expired"], ["missing", "Date needed"], ["archived", "Archived"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><ViewToggle mode={view} onChange={setView} /></div>
    {items.length === 0 ? <div className="rounded-2xl border border-dashed bg-card p-12 text-center shadow-soft"><Icon className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 font-display text-2xl">{records.length ? "No matching records" : warranty ? "No warranties yet" : "No renewals yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{records.length ? "Try a different search or status." : "Your saved records will appear here."}</p><Button className="mt-5 rounded-full" variant="outline" onClick={() => records.length ? (setQuery(""), setBucket("all")) : setOpen(true)}>{records.length ? "Clear filters" : "Add your first record"}</Button></div>
      : view === "grid" ? <div className="grid gap-3 md:grid-cols-2">{items.map((item) => { const status = trackingStatus(item); const date = trackingDate(item); return <Link key={item.id} to="/app/$section/$id" params={{ section, id: item.id }} className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary"><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">{field(item, "Provider") || "No provider"} · {date ? format(date, "d MMM yyyy") : "No date"}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(status.tone)}`}>{status.label}</span></div><ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></Link>; })}</div>
      : <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft"><table className="w-full text-sm"><thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">Name</th><th className="p-4">Provider</th><th className="p-4">{warranty ? "Expiry" : "Renewal"}</th><th className="p-4">Status</th><th /></tr></thead><tbody className="divide-y">{items.map((item) => { const status = trackingStatus(item); const date = trackingDate(item); return <tr key={item.id} className="hover:bg-secondary/40"><td className="p-4 font-semibold"><Link to="/app/$section/$id" params={{ section, id: item.id }} className="hover:text-primary">{item.title}</Link></td><td className="p-4 text-muted-foreground">{field(item, "Provider") || "—"}</td><td className="p-4">{date ? format(date, "d MMM yyyy") : "No date"}</td><td className="p-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(status.tone)}`}>{status.label}</span></td><td className="p-4 text-right"><Link to="/app/$section/$id" params={{ section, id: item.id }} aria-label={`Open ${item.title}`}><ChevronRight className="inline h-4 w-4" /></Link></td></tr>; })}</tbody></table></div>}
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
  const [tab, setTab] = useState<"Overview" | "Evidence" | "Related" | "Activity" | "AI insight">("Overview");
  const links = useRecordLinks(item.id);
  const status = trackingStatus(item);
  const date = trackingDate(item);
  const title = section === "warranties" ? "Warranties" : "Renewals";
  if (deleted) return <div className="p-8"><h1 className="font-display text-3xl">Record deleted</h1><Button asChild className="mt-4"><Link to="/app/$section" params={{ section }}>Back to {section}</Link></Button></div>;
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
    <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Home</Link> / <Link to="/app/$section" params={{ section }} className="hover:text-foreground">{title}</Link> / <span className="text-foreground">{item.title}</span></nav>
    <section className="rounded-[2rem] bg-midnight-glow p-8 text-midnight-foreground">
      <p className="text-sm text-midnight-foreground/60">{title}</p>
      <h1 className="mt-1 font-display text-4xl">{item.title}</h1>
      <p className="mt-2 text-midnight-foreground/70">{field(item, "Provider") || "No provider"} · {date ? format(date, "d MMMM yyyy") : "No date"}</p>
      <div className="mt-5"><span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass(status.tone)}`}>{status.label}</span></div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => setEdit(true)} className="flex items-center gap-2 rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-primary-foreground"><Pencil className="h-4 w-4" />Edit</button>
        <button disabled={!date} onClick={() => downloadReminder(item)} className="flex items-center gap-2 rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold disabled:opacity-50"><CalendarPlus className="h-4 w-4" />Calendar reminder</button>
        <button onClick={() => setConfirm(true)} className="rounded-full border border-destructive/50 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10">Delete</button>
      </div>
    </section>
    <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1">
      {(["Overview", "Evidence", "Related", "Activity", "AI insight"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>)}
    </div>
    <section className="rounded-3xl border bg-card p-6 shadow-soft">
      {tab === "Overview" && (item.fields.some(([, v]) => v) ? <dl className="grid gap-4 sm:grid-cols-2">{item.fields.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 break-words font-medium">{v}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">No details yet. Press Edit to add them.</p>)}
      {tab === "Evidence" && <Evidence itemId={item.id} />}
      {tab === "Related" && (links === null ? <p className="text-sm text-muted-foreground">Loading linked records…</p> : links.length ? <RelatedRecords links={links} /> : <p className="text-sm text-muted-foreground">Nothing linked yet. Records captured together in Add anything are linked automatically.</p>)}
      {tab === "AI insight" && <div className="flex gap-3 rounded-2xl bg-secondary p-5"><Sparkles className="h-5 w-5 shrink-0 text-violet" /><p className="text-sm">{item.insight ?? (date ? `MatrixKeep is watching this ${section === "warranties" ? "warranty" : "renewal"} and calculates its status from the saved date.` : "Add a date so MatrixKeep can track this record.")}</p></div>}
      {tab === "Activity" && <p className="text-sm text-muted-foreground">{date ? `${section === "warranties" ? "Expires" : "Renews"} on ${format(date, "d MMMM yyyy")}. Download a calendar reminder to be notified.` : "Add a date to start tracking this record."}</p>}
    </section>
    {edit && <TrackingEditor section={section} item={item} onClose={() => setEdit(false)} />}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogTitle>Delete this record?</DialogTitle><DialogDescription>This permanently removes {item.title}.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}><X />Cancel</Button><Button variant="destructive" onClick={async () => { try { await remove(section, item.id); setDeleted(true); setConfirm(false); toast.success("Record deleted"); await navigate({ to: "/app/$section", params: { section } }); } catch { toast.error("Couldn't delete. Please try again."); } }}><Trash2 />Delete</Button></div></DialogContent></Dialog>
  </div>;
}