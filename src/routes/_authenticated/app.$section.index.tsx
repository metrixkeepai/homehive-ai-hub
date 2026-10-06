import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getSection } from "@/components/hv/data";
import { type Profile, useStore, toneClass } from "@/components/hv/store";

export const Route = createFileRoute("/_authenticated/app/$section/")({
  validateSearch: (s: Record<string, unknown>): { add?: number } => (s["add"] ? { add: 1 } : {}),
  head: ({ params }) => {
    const s = getSection(params.section);
    const t = `${s?.title ?? "Not found"} — HomeVault AI`;
    return { meta: [{ title: t }, { name: "description", content: s?.intro ?? "" }, { property: "og:title", content: t }, { property: "og:description", content: s?.intro ?? "" }] };
  },
  component: SectionPage,
});

export function Missing() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl">This page doesn't exist</h1>
      <Link to="/app" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Back to Home</Link>
    </div>
  );
}

function SectionPage() {
  const { section } = Route.useParams();
  const search = Route.useSearch();
  const s = getSection(section);
  const { added, add } = useStore();
  const [open, setOpen] = useState(!!search.add);
  const [form, setForm] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  if (!s) return <Missing />;
  const items = [...(added[s.slug] ?? []), ...(s.slug === "profile" ? [] : s.items)].filter((i) => (i.title + i.subtitle).toLowerCase().includes(filter.toLowerCase()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = s.addFields ?? [];
    const first = fields[0] ?? "";
    const title = form[first]?.trim();
    if (!title) { toast.error(`Please enter ${first.toLowerCase()}`); return; }
    const ok = await add(s.slug, { id: `new-${Date.now()}`, title, subtitle: fields.slice(1).map((f) => form[f]).filter(Boolean).join(" · ") || "Just added", status: ["New", "primary"], fields: fields.map((f) => [f, form[f] || "—"]), actions: ["Edit"] });
    if (!ok) { toast.error("Couldn't save — please try again"); return; }
    toast.success(`${title} saved to your HomeVault`);
    setForm({}); setOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground"><Link to="/app" className="hover:text-foreground">Home</Link> / <span className="text-foreground">{s.title}</span></nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl"><s.icon className="h-7 w-7 text-primary" />{s.title}</h1>
          <p className="mt-2 text-muted-foreground">{s.intro}</p>
        </div>
        {s.addLabel && <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />{s.addLabel}</button>}
      </div>

      {s.slug === "profile" && <ProfileEditor />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {s.kpis.map(([l, v]) => (
          <button key={l} onClick={() => setFilter("")} className="rounded-2xl border bg-card p-4 text-left shadow-soft">
            <p className="font-display text-2xl">{v}</p><p className="text-sm text-muted-foreground">{l}</p>
          </button>
        ))}
      </div>

      {s.items.length > 2 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${s.title.toLowerCase()}…`} className="w-full rounded-full border bg-card px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />}

      <div className="grid gap-3 md:grid-cols-2">
        {items.length === 0 && <p className="rounded-2xl bg-secondary p-8 text-center text-sm text-muted-foreground md:col-span-2">Nothing matches “{filter}”.</p>}
        {items.map((i) => (
          <Link key={i.id} to="/app/$section/$id" params={{ section: s.slug, id: i.id }} className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{i.title}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{i.subtitle}</p>
              {i.status && <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(i.status[1])}`}>{i.status[0]}</span>}
            </div>
            {i.value && <p className="font-display text-xl">{i.value}</p>}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        ))}
      </div>

      {open && s.addFields && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <form onSubmit={submit} className="animate-rise w-full max-w-md space-y-4 rounded-3xl bg-card p-7 shadow-glow" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-display text-2xl">{s.addLabel}</h3><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            {s.addFields.map((f) => (
              <label key={f} className="block text-sm font-medium">{f}
                <input value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
              </label>
            ))}
            <button className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}

const inp = "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring";
const SECTORS = ["Retail / shop", "Restaurant / hospitality", "Office / professional services", "School / education", "Clinic / healthcare", "Garage / automotive", "Construction / trades", "Property company", "Charity", "Warehouse / logistics", "Manufacturing", "Technology", "Other"];

function ProfileEditor() {
  const { profile, email, saveProfile } = useStore();
  const [d, setD] = useState<Partial<Profile>>({});
  if (!profile) return <p className="text-sm text-muted-foreground">Loading your profile…</p>;
  const v = { ...profile, ...d };
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const biz = v.account_type === "business";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = (x: string | null | undefined, n = 200) => (x ?? "").trim().slice(0, n) || null;
    if (biz && !clean(v.org_name)) { toast.error("Please enter your organisation name"); return; }
    const ok = await saveProfile({
      display_name: clean(v.display_name, 100), household: clean(v.household), phone: clean(v.phone, 30), job_title: clean(v.job_title, 100),
      bio: clean(v.bio, 500), account_type: v.account_type, org_name: clean(v.org_name), sector: clean(v.sector, 100),
      language: v.language, currency: v.currency, timezone: v.timezone,
    });
    if (ok) { toast.success("Profile saved"); setD({}); } else toast.error("Couldn't save profile");
  };
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">Account type</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {([["individual", "Individual", "Your home, family, vehicles and belongings."], ["business", "Business", "Your organisation's locations, team, equipment and documents."]] as const).map(([k, t, desc]) => (
            <button type="button" key={k} onClick={() => setD((x) => ({ ...x, account_type: k }))} className={`rounded-2xl border p-4 text-left transition ${v.account_type === k ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-secondary"}`}>
              <p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-2">
        <h2 className="font-display text-xl md:col-span-2">Personal details</h2>
        <label className="block text-sm font-medium">Full name<input value={v.display_name ?? ""} onChange={set("display_name")} maxLength={100} className={inp} /></label>
        <label className="block text-sm font-medium">Email<input value={email} disabled className={inp + " opacity-60"} /></label>
        <label className="block text-sm font-medium">Phone<input value={v.phone ?? ""} onChange={set("phone")} maxLength={30} className={inp} /></label>
        <label className="block text-sm font-medium">{biz ? "Job title" : "Home address"}{biz
          ? <input value={v.job_title ?? ""} onChange={set("job_title")} maxLength={100} className={inp} />
          : <input value={v.household ?? ""} onChange={set("household")} maxLength={200} className={inp} />}</label>
        <label className="block text-sm font-medium md:col-span-2">About you<textarea value={v.bio ?? ""} onChange={set("bio")} maxLength={500} rows={2} className={inp} /></label>
      </div>
      {biz && (
        <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-2">
          <h2 className="font-display text-xl md:col-span-2">Organisation</h2>
          <label className="block text-sm font-medium">Organisation name<input value={v.org_name ?? ""} onChange={set("org_name")} maxLength={200} className={inp} /></label>
          <label className="block text-sm font-medium">Sector<select value={v.sector ?? ""} onChange={set("sector")} className={inp}><option value="">Choose…</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="block text-sm font-medium md:col-span-2">Head office address<input value={v.household ?? ""} onChange={set("household")} maxLength={200} className={inp} /></label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Link to="/app/$section" params={{ section: "locations" }} className="rounded-full border px-4 py-2 text-sm hover:bg-secondary">Manage locations</Link>
            <Link to="/app/$section" params={{ section: "team" }} className="rounded-full border px-4 py-2 text-sm hover:bg-secondary">Manage team</Link>
            <Link to="/app/$section" params={{ section: "roles" }} className="rounded-full border px-4 py-2 text-sm hover:bg-secondary">Roles & permissions</Link>
          </div>
        </div>
      )}
      <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-3">
        <h2 className="font-display text-xl md:col-span-3">Preferences</h2>
        <label className="block text-sm font-medium">Language<select value={v.language} onChange={set("language")} className={inp}>{["English (UK)", "English (US)", "Français", "Deutsch", "Español"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="block text-sm font-medium">Currency<select value={v.currency} onChange={set("currency")} className={inp}>{["GBP", "EUR", "USD"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="block text-sm font-medium">Time zone<select value={v.timezone} onChange={set("timezone")} className={inp}>{["Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai"].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="flex justify-end"><button className="rounded-full bg-aurora px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">Save profile</button></div>
    </form>
  );
}
