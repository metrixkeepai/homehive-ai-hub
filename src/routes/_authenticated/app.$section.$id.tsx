import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getSection, getItem } from "@/components/hv/data";
import { useStore, toneClass } from "@/components/hv/store";
import { Evidence } from "@/components/hv/Evidence";
import { useRecordLinks, RelatedRecords } from "@/components/hv/RecordLinks";
import { TrackingDetail } from "@/components/hv/Tracking";
import { GoogleIntegration, GoogleOverviewFields, googleConnectorFor } from "@/components/hv/GoogleIntegration";

export const Route = createFileRoute("/_authenticated/app/$section/$id")({
  head: ({ params }) => {
    const i = getItem(params.section, params.id);
    const t = `${i?.title ?? getSection(params.section)?.title ?? "Record"} details — MatrixKeep AI`;
    return { meta: [{ title: t }, { name: "description", content: i?.subtitle ?? "Your saved MatrixKeep record and supporting evidence." }, { property: "og:title", content: t }, { property: "og:description", content: i?.subtitle ?? "Your saved MatrixKeep record and supporting evidence." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: Detail,
});

const tabs = ["Overview", "Items", "Evidence", "Related", "Activity", "AI insight"] as const;

function Detail() {
  const { section, id } = Route.useParams();
  const s = getSection(section);
  const { added, remove } = useStore();
  const navigate = useNavigate();
  const item = getItem(section, id) ?? added[section]?.find((x) => x.id === id);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [done, setDone] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "table">("table");
  const own = !!added[section]?.some((x) => x.id === id);
  const saved = useRecordLinks(own ? id : "00000000-0000-0000-0000-000000000000");
  if (!s || !item) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl">We couldn't find that record</h1>
        <Link to="/app" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Back to Home</Link>
      </div>
    );
  }

  const isGoogle = section === "integrations" && !!googleConnectorFor[id];
  const shownTabs = tabs.filter((t) => t !== "Items" || section === "rooms");
  if ((section === "warranties" || section === "renewals") && added[section]?.some((x) => x.id === id)) return <TrackingDetail section={section} item={item} />;
  const roomItems = section === "rooms" ? [
    ...(added["assets"] ?? []).filter((a) => a.fields.some(([k, v]) => k === "Room" && v.toLowerCase() === item.title.toLowerCase())).map((a) => ({ a, own: true })),
    ...(item.links ?? []).filter(([sl]) => sl === "assets").map(([, lid]) => getItem("assets", lid)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ a, own: false })),
  ] : [];
  const fv = (a: { fields: [string, string][] }, k: string) => a.fields.find(([f]) => f.toLowerCase() === k)?.[1] ?? "—";
  const act = async (a: string) => {
    if (a === "Delete" && added[section]?.some((x) => x.id === id)) { await remove(section, id); toast.success("Deleted"); navigate({ to: "/app/$section", params: { section } }); return; }
    setDone((d) => [...d, a]);
    const [title, description] = actionToast(a, section, item.title);
    toast.success(title, { description });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">Home</Link> / <Link to="/app/$section" params={{ section: s.slug }} className="hover:text-foreground">{s.title}</Link> / <span className="text-foreground">{item.title}</span>
      </nav>

      <section className="rounded-[2rem] bg-midnight-glow p-8 text-midnight-foreground">
        <p className="text-sm text-midnight-foreground/60">{s.title}</p>
        <h1 className="mt-1 font-display text-4xl">{item.title}</h1>
        <p className="mt-2 text-midnight-foreground/70">{item.subtitle}</p>
        {isGoogle ? <GoogleIntegration id={id} /> : <>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {item.status && <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass(item.status[1])}`}>{item.status[0]}</span>}
          {item.value && <span className="font-display text-2xl">{item.value}</span>}
        </div>
        {item.actions && (
          <div className="mt-6 flex flex-wrap gap-2">
            {item.actions.map((a, idx) => (
              <button key={a} disabled={done.includes(a)} onClick={() => act(a)} className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${idx === 0 ? "bg-aurora text-primary-foreground" : "border border-midnight-foreground/20"}`}>
                {done.includes(a) ? `✓ ${a}` : a}
              </button>
            ))}
          </div>
        )}
        </>}
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1">
        {shownTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        {tab === "Overview" && isGoogle && <GoogleOverviewFields id={id} />}
        {tab === "Overview" && !isGoogle && (item.fields.length ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            {item.fields.map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}
          </dl>
        ) : <p className="text-sm text-muted-foreground">No details yet. Use the buttons above to get started.</p>)}
        {tab === "Overview" && !isGoogle && own && section !== "documents" && (() => {
          const l = saved?.find((x) => x.section === "documents");
          const d = l && added["documents"]?.find((x) => x.id === l.id);
          if (!l) return null;
          const g = (re: RegExp) => d?.fields.find(([k]) => re.test(k))?.[1];
          const own_ = (re: RegExp) => item.fields.find(([k]) => re.test(k))?.[1];
          const rows: [string, string | undefined][] = [
            ["Invoice #", g(/invoice (number|no|#)|receipt (number|no)/i)],
            ["Issue date", g(/invoice date|issue date|^date/i)],
            ["Supplier", g(/supplier$|service provider|retailer|vendor|merchant/i)],
            ["Related line", own_(/issue|description/i) ?? item.title],
            ["Amount", own_(/line total|amount|price/i) ?? item.value],
          ];
          return (
            <div className="mt-6 rounded-2xl border p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source document</p>
              <p className="mt-1 font-display text-lg">{l.title}</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
              <Link to="/app/$section/$id" params={{ section: "documents", id: l.id }} className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">View Source Document</Link>
            </div>
          );
        })()}

        {tab === "Items" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{roomItems.length} item(s) recorded in {item.title}</p>
              <div className="flex rounded-full border p-0.5 text-xs">{(["table", "grid"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-primary text-primary-foreground" : ""}`}>{v}</button>)}</div>
            </div>
            {roomItems.length === 0 && <p className="text-sm text-muted-foreground">No items yet. Use “Add anything → Scan room” and choose this room to fill it.</p>}
            {view === "table" && roomItems.length > 0 && (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="py-2">Item</th><th>Brand</th><th>Value</th><th>Purchased</th><th>Source</th></tr></thead>
                <tbody>{roomItems.map(({ a, own }) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/50">
                    <td className="py-2"><Link to="/app/$section/$id" params={{ section: "assets", id: a.id }} className="font-medium text-primary hover:underline">{a.title}</Link></td>
                    <td>{fv(a, "brand")}</td><td>{a.value ?? fv(a, "price")}</td><td>{fv(a, "purchase date")}</td><td className="text-xs text-muted-foreground">{own ? "Yours" : "Sample"}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
            {view === "grid" && (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{roomItems.map(({ a }) => (
                <Link key={a.id} to="/app/$section/$id" params={{ section: "assets", id: a.id }} className="rounded-2xl border p-4 hover:border-primary"><p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.subtitle}</p></Link>
              ))}</div>
            )}
          </div>
        )}

        {tab === "Evidence" && (added[section]?.some((x) => x.id === id)
          ? <Evidence itemId={id} />
          : <p className="text-sm text-muted-foreground">This is a sample record. Add your own record to attach photos, receipts and PDFs.</p>)}

        {tab === "Related" && own && (saved === null ? <p className="text-sm text-muted-foreground">Loading linked records…</p> : saved.length ? <RelatedRecords links={saved} /> : <p className="text-sm text-muted-foreground">Nothing linked yet. Records captured together in Add anything are linked automatically.</p>)}
        {tab === "Related" && !own && (item.links?.length ? (
          <div className="space-y-2">
            {item.links.map(([sl, lid]) => {
              const ls = getSection(sl); const li = getItem(sl, lid);
              if (!ls || !li) return null;
              return (
                <Link key={sl + lid} to="/app/$section/$id" params={{ section: sl, id: lid }} className="flex items-center gap-3 rounded-2xl border p-4 transition hover:border-primary">
                  <ls.icon className="h-5 w-5 text-primary" />
                  <div className="flex-1"><p className="font-semibold">{li.title}</p><p className="text-xs text-muted-foreground">{ls.title}</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nothing linked yet. Your AI team links related records automatically.</p>)}

        {tab === "Activity" && (item.timeline?.length ? (
          <ol className="space-y-4 border-l pl-5">
            {[...item.timeline, ...(own && saved ? saved.map((l) => [new Date(l.at).toLocaleDateString(), `Linked to ${l.title} (${l.label.toLowerCase()})`] as [string, string]) : [])].map(([d, e]) => <li key={d + e} className="relative"><span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-aurora" /><p className="text-xs text-muted-foreground">{d}</p><p className="font-medium">{e}</p></li>)}
          </ol>
        ) : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>)}

        {tab === "AI insight" && (
          <div className="flex gap-3 rounded-2xl bg-secondary p-5">
            <Sparkles className="h-5 w-5 shrink-0 text-violet" />
            <p className="text-sm">{item.insight ?? "Everything looks good here. Your AI team will flag anything that needs you."}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function actionToast(a: string, section: string, name: string): [string, string] {
  const l = a.toLowerCase();
  if (l.includes("scan room")) return ["Room scan ready", `Use Add anything → Scan room to let Sera organise what's in ${name}.`];
  if (l.includes("warranty") || section === "warranties") return ["Warranty protected", "MatrixKeep is watching this warranty and will remind you before it expires."];
  if (section === "renewals" || l.includes("renew")) return ["Renewal is being watched", "Sera will keep an eye on this date and let you know before action is needed."];
  if (l.includes("mot") || l.includes("service") || l.includes("booking")) return ["Request noted", `Sera has added this to the timeline for ${name}.`];
  if (l.includes("mark") || l.includes("complete") || l.includes("descaled")) return ["Maintenance updated", "MatrixKeep will remind you when it's time to act again."];
  if (l.includes("mileage")) return ["Vehicle updated", "Sera has added the latest information to its digital passport."];
  if (l.includes("claim")) return ["Claim started", "MatrixKeep is gathering the evidence linked to this record."];
  if (l.includes("download") || l.includes("export")) return ["Preparing your file", `${name} is being put together for you.`];
  if (l.includes("ai") || l.includes("extraction") || l.includes("run now")) return ["Sera is on it", `${name} is being reviewed with your latest records.`];
  if (l.includes("invite") || l.includes("permission")) return ["Access updated", "Your team settings have been noted."];
  if (section === "insurance") return ["Insurance record updated", "MatrixKeep is tracking the important dates and evidence."];
  if (section === "assets") return ["Digital passport updated", "Your asset is organised and ready for MatrixKeep to track."];
  return [`${a} noted`, `MatrixKeep has recorded this for ${name}.`];
}
