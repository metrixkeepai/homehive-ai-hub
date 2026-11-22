import { useQuery } from "@tanstack/react-query";
import { connectionCount } from "@/lib/connector-checks.functions";
import { ConnectorNotifications } from "@/components/hv/ConnectorNotifications";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSection } from "@/components/hv/data";
import { type Profile, useStore, toneClass } from "@/components/hv/store";
import { TrackingPage } from "@/components/hv/Tracking";
import { PropertiesPage } from "@/components/hv/Properties";
import { RecordEditor } from "@/components/hv/RecordEditor";
import { COUNTRIES } from "@/lib/countries";
import { BillingPage } from "@/components/hv/Billing";
import { ViewToggle, useViewMode } from "@/components/hv/ViewToggle";
import { STUB_NAV_SLUGS } from "@/components/hv/navigation";

export const Route = createFileRoute("/_authenticated/app/$section/")({
  validateSearch: (s: Record<string, unknown>): { add?: number } => (s["add"] ? { add: 1 } : {}),
  head: ({ params }) => {
    const s = getSection(params.section);
    const t = `${s?.title ?? "Not found"} — MatrixKeep AI`;
    return {
      meta: [
        { title: t },
        { name: "description", content: s?.intro ?? "" },
        { property: "og:title", content: t },
        { property: "og:description", content: s?.intro ?? "" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SectionPage,
});

export function Missing() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl">This page doesn't exist</h1>
      <Link
        to="/app"
        className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Back to Home
      </Link>
    </div>
  );
}

function SectionPage() {
  const { section } = Route.useParams();
  const search = Route.useSearch();
  const s = getSection(section);
  const { added, remove } = useStore();
  const [open, setOpen] = useState(!!search.add);
  const [filter, setFilter] = useState("");
  const [docType, setDocType] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useViewMode(section);
  const connected = useQuery({
    queryKey: ["connected-count"],
    queryFn: () => connectionCount(),
    enabled: section === "integrations",
    staleTime: 0,
  });
  if (!s) return <Missing />;
  if (section === "notifications") return <ConnectorNotifications />;
  if (section === "billing") return <BillingPage />;
  if (section === "my-home" || section === "locations") return <PropertiesPage slug={section} />;
  if (section === "warranties" || section === "renewals")
    return <TrackingPage key={section} section={section} startOpen={!!search.add} />;
  if (STUB_NAV_SLUGS.has(section))
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">{s.title}</h1>
        <p className="mt-4 text-muted-foreground">
          This capability is not available in this release. No background automation or
          notifications are running.
        </p>
      </div>
    );
  const own = added[s.slug] ?? [];
  // Integrations keep static connector config; every other section is backend-only.
  const source = s.slug === "integrations" ? [...own, ...s.items] : own;
  const items = source
    .filter((i) =>
      (i.title + i.subtitle + " " + i.fields.map(([, v]) => v).join(" "))
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .filter(
      (i) =>
        section !== "documents" ||
        ((docType === "All" || docTypeOf(i) === docType) && (showArchived || !isArchived(i))),
    );
  const liveKpis: [string, string][] =
    s.slug === "integrations"
      ? [
          ["Connectors", String(source.length)],
          ["Connected", connected.data === undefined ? "—" : String(connected.data)],
        ]
      : [
          ["Records", String(own.length)],
          ["Active", String(own.filter((i) => !isArchived(i)).length)],
          ...(section === "documents"
            ? ([["Types", String(new Set(own.map(docTypeOf)).size)]] as [string, string][])
            : []),
          ...(own.some((i) => i.value)
            ? ([["With value", String(own.filter((i) => i.value).length)]] as [string, string][])
            : []),
        ];
  const docTypes =
    section === "documents" ? ["All", ...Array.from(new Set(own.map(docTypeOf))).sort()] : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">{s.title}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl">
            <s.icon className="h-7 w-7 text-primary" />
            {s.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{s.intro}</p>
        </div>
        {s.addLabel && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" />
            {s.addLabel}
          </button>
        )}
      </div>

      {s.slug === "profile" && <ProfileEditor />}

      {liveKpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {liveKpis.map(([l, v]) => (
            <button
              key={l}
              onClick={() => setFilter("")}
              className="rounded-2xl border bg-card p-4 text-left shadow-soft"
            >
              <p className="font-display text-2xl">{v}</p>
              <p className="text-sm text-muted-foreground">{l}</p>
            </button>
          ))}
        </div>
      )}

      {s.slug !== "profile" && (
        <div className="flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${s.title.toLowerCase()}…`}
            className="min-w-0 flex-1 rounded-full border bg-card px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <ViewToggle mode={view} onChange={setView} />
        </div>
      )}
      {section === "documents" && (
        <div className="flex flex-wrap items-center gap-2">
          {docTypes.map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${docType === t ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary"}`}
            >
              {t}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
      )}

      {view === "table" && s.slug !== "profile" ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Details</th>
                <th className="p-4">Status</th>
                <th className="p-4">Value</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {filter
                      ? `Nothing matches “${filter}”.`
                      : own.length === 0
                        ? `No ${s.title.toLowerCase()} saved yet.`
                        : "Nothing to show."}
                  </td>
                </tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-secondary/40">
                  <td className="p-4 font-semibold">
                    <Link
                      to="/app/$section/$id"
                      params={{ section: s.slug, id: i.id }}
                      className="hover:text-primary"
                    >
                      {i.title}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate p-4 text-muted-foreground">{i.subtitle}</td>
                  <td className="p-4">
                    {i.status && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(i.status[1])}`}
                      >
                        {i.status[0]}
                      </span>
                    )}
                  </td>
                  <td className="p-4">{i.value ?? "—"}</td>
                  <td className="p-4 text-right">
                    {added[s.slug]?.some((x) => x.id === i.id) && (
                      <button
                        aria-label={`Delete ${i.title}`}
                        onClick={async () => {
                          if (!confirm(`Delete “${i.title}”? This can't be undone.`)) return;
                          try {
                            await remove(s.slug, i.id);
                            toast.success(`${i.title} deleted`);
                          } catch {
                            toast.error("Couldn't delete — please try again");
                          }
                        }}
                        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.length === 0 && (
            <p className="rounded-2xl bg-secondary p-8 text-center text-sm text-muted-foreground md:col-span-2">
              {filter
                ? `Nothing matches “${filter}”.`
                : own.length === 0
                  ? `No ${s.title.toLowerCase()} saved yet.`
                  : "Nothing to show."}
            </p>
          )}
          {items.map((i) => (
            <Link
              key={i.id}
              to="/app/$section/$id"
              params={{ section: s.slug, id: i.id }}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{i.subtitle}</p>
                {i.status && (
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass(i.status[1])}`}
                  >
                    {i.status[0]}
                  </span>
                )}
              </div>
              {i.value && <p className="font-display text-xl">{i.value}</p>}
              {added[s.slug]?.some((x) => x.id === i.id) && (
                <button
                  aria-label={`Delete ${i.title}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm(`Delete “${i.title}”? This can't be undone.`)) return;
                    try {
                      await remove(s.slug, i.id);
                      toast.success(`${i.title} deleted`);
                    } catch {
                      toast.error("Couldn't delete — please try again");
                    }
                  }}
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}

      {open && s.addFields && (
        <RecordEditor
          section={s.slug}
          addFields={s.addFields}
          {...(s.addLabel ? { title: s.addLabel } : {})}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring";
const SECTORS = [
  "Retail / shop",
  "Restaurant / hospitality",
  "Office / professional services",
  "School / education",
  "Clinic / healthcare",
  "Garage / automotive",
  "Construction / trades",
  "Property company",
  "Charity",
  "Warehouse / logistics",
  "Manufacturing",
  "Technology",
  "Other",
];

function ProfileEditor() {
  const { profile, email, saveProfile } = useStore();
  const [d, setD] = useState<Partial<Profile>>({});
  if (!profile) return <p className="text-sm text-muted-foreground">Loading your profile…</p>;
  const v = { ...profile, ...d };
  const set =
    (k: keyof Profile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value }));
  const biz = v.account_type === "business";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = (x: string | null | undefined, n = 200) => (x ?? "").trim().slice(0, n) || null;
    if (biz && !clean(v.org_name)) {
      toast.error("Please enter your organisation name");
      return;
    }
    const ok = await saveProfile({
      display_name: clean(v.display_name, 100),
      household: clean(v.household),
      phone: clean(v.phone, 30),
      job_title: clean(v.job_title, 100),
      bio: clean(v.bio, 500),
      account_type: v.account_type,
      org_name: clean(v.org_name),
      sector: clean(v.sector, 100),
      language: v.language,
      currency: v.currency,
      timezone: v.timezone,
      country: v.country,
    });
    if (ok) {
      toast.success("Profile saved");
      setD({});
    } else toast.error("Couldn't save profile");
  };
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">Account type</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["individual", "Individual", "Your home, family, vehicles and belongings."],
              [
                "business",
                "Business",
                "Your organisation's locations, team, equipment and documents.",
              ],
            ] as const
          ).map(([k, t, desc]) => (
            <button
              type="button"
              key={k}
              onClick={() => setD((x) => ({ ...x, account_type: k }))}
              className={`rounded-2xl border p-4 text-left transition ${v.account_type === k ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-secondary"}`}
            >
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-2">
        <h2 className="font-display text-xl md:col-span-2">Personal details</h2>
        <label className="block text-sm font-medium">
          Full name
          <input
            value={v.display_name ?? ""}
            onChange={set("display_name")}
            maxLength={100}
            className={inp}
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input value={email} disabled className={inp + " opacity-60"} />
        </label>
        <label className="block text-sm font-medium">
          Phone
          <input value={v.phone ?? ""} onChange={set("phone")} maxLength={30} className={inp} />
        </label>
        <label className="block text-sm font-medium">
          {biz ? "Job title" : "Home address"}
          {biz ? (
            <input
              value={v.job_title ?? ""}
              onChange={set("job_title")}
              maxLength={100}
              className={inp}
            />
          ) : (
            <input
              value={v.household ?? ""}
              onChange={set("household")}
              maxLength={200}
              className={inp}
            />
          )}
        </label>
        <label className="block text-sm font-medium md:col-span-2">
          About you
          <textarea
            value={v.bio ?? ""}
            onChange={set("bio")}
            maxLength={500}
            rows={2}
            className={inp}
          />
        </label>
      </div>
      {biz && (
        <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-2">
          <h2 className="font-display text-xl md:col-span-2">Organisation</h2>
          <label className="block text-sm font-medium">
            Organisation name
            <input
              value={v.org_name ?? ""}
              onChange={set("org_name")}
              maxLength={200}
              className={inp}
            />
          </label>
          <label className="block text-sm font-medium">
            Sector
            <select value={v.sector ?? ""} onChange={set("sector")} className={inp}>
              <option value="">Choose…</option>
              {SECTORS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            Head office address
            <input
              value={v.household ?? ""}
              onChange={set("household")}
              maxLength={200}
              className={inp}
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Link
              to="/app/$section"
              params={{ section: "locations" }}
              className="rounded-full border px-4 py-2 text-sm hover:bg-secondary"
            >
              Manage locations
            </Link>
            <Link
              to="/app/$section"
              params={{ section: "team" }}
              className="rounded-full border px-4 py-2 text-sm hover:bg-secondary"
            >
              Manage team
            </Link>
            <Link
              to="/app/$section"
              params={{ section: "roles" }}
              className="rounded-full border px-4 py-2 text-sm hover:bg-secondary"
            >
              Roles & permissions
            </Link>
          </div>
        </div>
      )}
      <div className="grid gap-4 rounded-3xl border bg-card p-6 shadow-soft md:grid-cols-3">
        <h2 className="font-display text-xl md:col-span-3">Preferences</h2>
        <label className="block text-sm font-medium">
          Language
          <select value={v.language} onChange={set("language")} className={inp}>
            {["English (UK)", "English (US)", "Français", "Deutsch", "Español"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Currency
          <select value={v.currency} onChange={set("currency")} className={inp}>
            {["GBP", "EUR", "USD"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Country
          <select value={v.country} onChange={set("country")} className={inp}>
            {COUNTRIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Time zone
          <select value={v.timezone} onChange={set("timezone")} className={inp}>
            {[
              "Europe/London",
              "Europe/Paris",
              "America/New_York",
              "America/Los_Angeles",
              "Asia/Dubai",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button className="rounded-full bg-aurora px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          Save profile
        </button>
      </div>
    </form>
  );
}

const docField = (i: { fields: [string, string][] }, k: string) =>
  i.fields.find(([f]) => f.toLowerCase() === k.toLowerCase())?.[1]?.trim() ?? "";
function docTypeOf(i: { fields: [string, string][] }) {
  return docField(i, "Document type") || docField(i, "Type") || "Other";
}
function isArchived(i: { fields: [string, string][] }) {
  return /^(archived|superseded)$/i.test(docField(i, "Status"));
}
