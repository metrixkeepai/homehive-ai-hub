import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getSection, getItem } from "@/components/hv/data";
import { useStore, toneClass } from "@/components/hv/store";
import { Evidence } from "@/components/hv/Evidence";
import { TrackingDetail } from "@/components/hv/Tracking";

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
  if (!s || !item) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl">We couldn't find that record</h1>
        <Link to="/app" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Back to Home</Link>
      </div>
    );
  }

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
    toast.success(`${a} — done`, { description: "Demo action. Real bookings, payments and connections will be wired up next." });
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
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1">
        {shownTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        {tab === "Overview" && (item.fields.length ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            {item.fields.map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}
          </dl>
        ) : <p className="text-sm text-muted-foreground">No details yet. Use the buttons above to get started.</p>)}

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

        {tab === "Related" && (item.links?.length ? (
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
            {item.timeline.map(([d, e]) => <li key={d + e} className="relative"><span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-aurora" /><p className="text-xs text-muted-foreground">{d}</p><p className="font-medium">{e}</p></li>)}
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
