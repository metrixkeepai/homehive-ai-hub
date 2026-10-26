import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, Pencil, Archive, Trash2, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getSection, sections, type Item } from "./data";
import { useStore, isArchivedItem, PROPERTY_SLUGS, toneClass } from "./store";
import { COUNTRIES } from "@/lib/countries";
import { planByKey } from "@/lib/plans";
import { ViewToggle, useViewMode } from "./ViewToggle";

export const PERSONAL_TYPES = ["Home", "House", "Apartment", "Flat", "Holiday Home", "Rental Property", "Investment Property", "Garage / Outbuilding", "Other Property"];
export const BUSINESS_TYPES = ["Office", "Branch", "Store", "Clinic", "Restaurant", "Warehouse", "School", "Site", "Factory", "Workshop", "Rental Property", "Commercial Property", "Other Location"];

const fv = (i: Item, ...keys: string[]) => { for (const k of keys) { const v = i.fields.find(([f]) => f.toLowerCase() === k.toLowerCase())?.[1]; if (v && v !== "—") return v; } return ""; };
export const propertyType = (i: Item) => fv(i, "Property type", "Location type", "Type (shop, office, warehouse…)", "Type");

/** Records in the current workspace linked to a property, grouped by section. */
export function useLinkedRecords(propertyId: string | null | undefined) {
  const { added } = useStore();
  return Object.entries(added).filter(([slug]) => !PROPERTY_SLUGS.includes(slug)).flatMap(([slug, list]) => list.filter((i) => i.propertyId === propertyId).map((i) => ({ slug, item: i })));
}

/** Property picker used by add forms, Add anything and record details. */
export function PropertySelect({ value, onChange, className = "", allowNone = true }: { value: string | null; onChange: (v: string | null) => void; className?: string; allowNone?: boolean }) {
  const { properties, current } = useStore();
  const biz = current.type !== "individual";
  const active = properties.filter((p) => !isArchivedItem(p) || p.id === value);
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={className}>
      {allowNone && <option value="">{active.length ? `No ${biz ? "location" : "property"} (unassigned)` : `No ${biz ? "locations" : "properties"} yet`}</option>}
      {active.map((p) => <option key={p.id} value={p.id}>{p.title}{isArchivedItem(p) ? " (archived)" : ""}</option>)}
    </select>
  );
}

/** Default property for new records: the only active one, otherwise none. */
export function useDefaultProperty() {
  const { properties } = useStore();
  const active = properties.filter((p) => !isArchivedItem(p));
  return active.length === 1 ? active[0]!.id : null;
}

type Form = { name: string; type: string; address: string; city: string; postcode: string; country: string; notes: string };
function PropertyForm({ item, onClose }: { item?: Item | undefined; onClose: () => void }) {
  const { add, update, propertySlug, current, profile } = useStore();
  const biz = current.type !== "individual";
  const noun = biz ? "location" : "property";
  const [f, setF] = useState<Form>({
    name: item?.title ?? "", type: item ? propertyType(item) : biz ? "Office" : "Home", address: item ? fv(item, "Address") : "",
    city: item ? fv(item, "City") : "", postcode: item ? fv(item, "Postcode") : "", country: item ? fv(item, "Country") || profile?.country || "United Kingdom" : profile?.country || "United Kingdom", notes: item ? fv(item, "Notes") : "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) { toast.error(`Please enter a ${noun} name`); return; }
    if (!f.country) { toast.error("Please choose a country"); return; }
    setBusy(true);
    const keep = (item?.fields ?? []).filter(([k]) => !/^(property name|location name|property type|location type|type|type \(shop, office, warehouse…\)|address|city|postcode|country|notes)$/i.test(k));
    const fields: [string, string][] = [[biz ? "Location type" : "Property type", f.type], ["Address", f.address.trim() || "—"], ["City", f.city.trim() || "—"], ["Postcode", f.postcode.trim() || "—"], ["Country", f.country], ...(f.notes.trim() ? [["Notes", f.notes.trim()] as [string, string]] : []), ...keep];
    const subtitle = [f.type, f.city.trim(), f.country].filter(Boolean).join(" · ");
    const ok = item ? await update(item.id, { ...item, title: name, subtitle, fields }) : await add(propertySlug, { id: "", title: name, subtitle, fields, status: ["Active", "success"] });
    setBusy(false);
    if (!ok) { if (item) toast.error("Couldn't save — please try again"); return; }
    toast.success(item ? `${name} updated` : `${name} added`);
    onClose();
  };
  const input = "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="animate-rise max-h-[min(90vh,44rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-card p-7 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-display text-2xl">{item ? `Edit ${noun}` : `Add ${noun}`}</h3><button type="button" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <label className="block text-sm font-medium">{biz ? "Location name" : "Property name"}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={biz ? "e.g. Bristol branch" : "e.g. 14 Elm Grove"} className={input} /></label>
        <label className="block text-sm font-medium">{biz ? "Location type" : "Property type"}
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={input}>{(biz ? BUSINESS_TYPES : PERSONAL_TYPES).map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={input} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Town / city<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={input} /></label>
          <label className="block text-sm font-medium">Postcode<input value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} className={input} /></label>
        </div>
        <label className="block text-sm font-medium">Country
          <select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className={input}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Notes<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className={input} /></label>
        <button disabled={busy} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : item ? "Save changes" : `Save ${noun}`}</button>
      </form>
    </div>
  );
}

export function usePropertyActions() {
  const { update, remove, added } = useStore();
  const setArchived = async (p: Item, arch: boolean) => {
    const fields: [string, string][] = [...p.fields.filter(([k]) => k !== "Status"), ...(arch ? [["Status", "Archived"] as [string, string]] : [])];
    if (await update(p.id, { ...p, fields, status: arch ? ["Archived", "muted"] : ["Active", "success"] })) toast.success(arch ? `${p.title} archived` : `${p.title} restored`, { description: arch ? "Its records are kept and stay linked." : undefined });
    else toast.error("Couldn't update — please try again");
  };
  const del = async (slug: string, p: Item) => {
    const linked = Object.entries(added).filter(([s]) => !PROPERTY_SLUGS.includes(s)).reduce((n, [, l]) => n + l.filter((i) => i.propertyId === p.id).length, 0);
    if (linked > 0) {
      if (confirm(`“${p.title}” has ${linked} linked record${linked === 1 ? "" : "s"} (rooms, assets, documents…). It can't be deleted while records are linked, so nothing is lost.\n\nArchive it instead?`)) await setArchived(p, true);
      return false;
    }
    if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return false;
    try { await remove(slug, p.id); toast.success(`${p.title} deleted`); return true; } catch { toast.error("Couldn't delete — please try again"); return false; }
  };
  return { setArchived, del };
}

export function PropertiesPage({ slug }: { slug: string }) {
  const s = getSection(slug)!;
  const { added, current, profile, properties } = useStore();
  const biz = current.type !== "individual";
  const noun = biz ? "location" : "property";
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const [type, setType] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useViewMode(slug);
  const { setArchived, del } = usePropertyActions();
  const own = added[slug] ?? [];
  const max = planByKey(profile?.plan).limits.places;
  const active = properties.filter((p) => !isArchivedItem(p));
  const count = (id: string, sec: string) => (added[sec] ?? []).filter((i) => i.propertyId === id).length;
  const rows = own
    .filter((i) => (showArchived || !isArchivedItem(i)) && (type === "All" || propertyType(i) === type))
    .filter((i) => (i.title + " " + i.subtitle + " " + i.fields.map(([, v]) => v).join(" ")).toLowerCase().includes(filter.toLowerCase()));
  const types = ["All", ...new Set(own.map(propertyType).filter(Boolean))];
  const kpis: [string, string][] = [
    [biz ? "Locations" : "Properties", String(active.length)],
    ["Plan allowance", Number.isFinite(max) ? `${own.length} of ${max}` : "Unlimited"],
    ["Rooms linked", String(own.reduce((n, p) => n + count(p.id, "rooms"), 0))],
    ["Archived", String(own.length - active.length)],
  ];
  const actions = (p: Item) => own.some((x) => x.id === p.id) && (
    <div className="flex items-center gap-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)} className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
      <button aria-label={isArchivedItem(p) ? `Restore ${p.title}` : `Archive ${p.title}`} onClick={() => void setArchived(p, !isArchivedItem(p))} className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">{isArchivedItem(p) ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
      <button aria-label={`Delete ${p.title}`} onClick={() => void del(slug, p)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Home</Link> / <span className="text-foreground">{s.title}</span></nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl"><s.icon className="h-7 w-7 text-primary" />{s.title}</h1>
          <p className="mt-2 text-muted-foreground">{biz ? "Every site your organisation runs, with its rooms, equipment and records." : "Each property you own or look after, with its rooms, belongings and records."}</p>
        </div>
        <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />Add {noun}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([l, v]) => <div key={l} className="rounded-2xl border bg-card p-4 shadow-soft"><p className="font-display text-2xl">{v}</p><p className="text-sm text-muted-foreground">{l}</p></div>)}
      </div>
      {!own.length && <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">No {noun} saved yet. Add your first {noun} to start linking rooms, assets and documents.</p>}
      <div className="flex items-center gap-3"><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${biz ? "locations" : "properties"}…`} className="min-w-0 flex-1 rounded-full border bg-card px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" /><ViewToggle mode={view} onChange={setView} /></div>
      <div className="flex flex-wrap items-center gap-2">{types.map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary"}`}>{t}</button>)}<label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label></div>
      {view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft"><table className="w-full text-sm"><thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">Name</th><th className="p-4">Type</th><th className="p-4">Address</th><th className="p-4">Country</th><th className="p-4">Rooms</th><th className="p-4">Assets</th><th className="p-4">Status</th><th /></tr></thead>
          <tbody className="divide-y">{rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No {biz ? "locations" : "properties"} to show.</td></tr>}{rows.map((p) => (
            <tr key={p.id} className="hover:bg-secondary/40">
              <td className="p-4 font-semibold"><Link to="/app/$section/$id" params={{ section: slug, id: p.id }} className="hover:text-primary">{p.title}</Link></td>
              <td className="p-4">{propertyType(p) || "—"}</td>
              <td className="max-w-xs truncate p-4 text-muted-foreground">{[fv(p, "Address"), fv(p, "City"), fv(p, "Postcode")].filter(Boolean).join(", ") || "—"}</td>
              <td className="p-4">{fv(p, "Country") || "—"}</td>
              <td className="p-4">{count(p.id, "rooms")}</td><td className="p-4">{count(p.id, "assets")}</td>
              <td className="p-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(isArchivedItem(p) ? "muted" : p.status?.[1] ?? "success")}`}>{isArchivedItem(p) ? "Archived" : p.status?.[0] ?? "Active"}</span></td>
              <td className="p-4 text-right">{actions(p)}</td>
            </tr>))}</tbody></table></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.length === 0 && <p className="rounded-2xl bg-secondary p-8 text-center text-sm text-muted-foreground md:col-span-2">No {biz ? "locations" : "properties"} to show.</p>}
          {rows.map((p) => (
            <Link key={p.id} to="/app/$section/$id" params={{ section: slug, id: p.id }} className={`group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary ${isArchivedItem(p) ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.subtitle}</p>
                <p className="mt-2 text-xs text-muted-foreground">{count(p.id, "rooms")} rooms · {count(p.id, "assets")} assets · {count(p.id, "documents")} documents</p>
                <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(isArchivedItem(p) ? "muted" : p.status?.[1] ?? "success")}`}>{isArchivedItem(p) ? "Archived" : p.status?.[0] ?? "Active"}</span>
              </div>
              {actions(p)}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
      {editing && <PropertyForm item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** "In this property" panel on a property's detail page. */
export function PropertyContents({ propertyId }: { propertyId: string }) {
  const linked = useLinkedRecords(propertyId);
  if (!linked.length) return <p className="text-sm text-muted-foreground">Nothing is linked to this property yet. Choose it when you add a room, asset or document, or from Add anything.</p>;
  const groups = sections.filter((s) => linked.some((l) => l.slug === s.slug));
  return (
    <div className="space-y-5">
      {groups.map((s) => (
        <div key={s.slug}>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><s.icon className="h-3.5 w-3.5" />{s.title} ({linked.filter((l) => l.slug === s.slug).length})</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {linked.filter((l) => l.slug === s.slug).map(({ item }) => (
              <Link key={item.id} to="/app/$section/$id" params={{ section: s.slug, id: item.id }} className="flex items-center justify-between rounded-xl border p-3 text-sm hover:border-primary"><span className="truncate font-medium">{item.title}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyEditButton({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold">Edit</button>
    {open && <PropertyForm item={item} onClose={() => setOpen(false)} />}
  </>;
}
