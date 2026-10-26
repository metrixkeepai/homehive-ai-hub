import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getSection } from "@/components/hv/data";
import { useStore, toneClass, PROPERTY_SLUGS } from "@/components/hv/store";
import { Evidence, type Proposed } from "@/components/hv/Evidence";
import { useFeature, Locked } from "@/components/hv/Feature";
import { useRecordLinks, RelatedRecords } from "@/components/hv/RecordLinks";
import { TrackingDetail } from "@/components/hv/Tracking";
import { PropertyContents, PropertyEditButton } from "@/components/hv/Properties";
import { RecordEditor } from "@/components/hv/RecordEditor";
import {
  GoogleIntegration,
  GoogleOverviewFields,
  googleConnectorFor,
} from "@/components/hv/GoogleIntegration";
import { PassportModal, PASSPORT_KINDS } from "@/components/hv/PassportModal";
import {
  AppModal,
  AppModalForm,
  AppModalInput,
  AppModalPrimaryButton,
} from "@/components/hv/AppModal";

export const Route = createFileRoute("/_authenticated/app/$section/$id")({
  head: ({ params }) => {
    const t = `${getSection(params.section)?.title ?? "Record"} details — MatrixKeep AI`;
    return {
      meta: [
        { title: t },
        {
          name: "description",
          content: "Your saved MatrixKeep record and supporting evidence.",
        },
        { property: "og:title", content: t },
        {
          property: "og:description",
          content: "Your saved MatrixKeep record and supporting evidence.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Detail,
});

const tabs = ["Overview", "Items", "Evidence", "Related", "Activity", "AI insight"] as const;

function Detail() {
  const { section, id } = Route.useParams();
  const s = getSection(section);
  const { added, remove, update, profile, email, findRecord } = useStore();
  const [proposal, setProposal] = useState<Proposed | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoadingRecord(true);
    setLoadError("");
    if (section === "integrations") {
      setLoadingRecord(false);
      return;
    }
    void findRecord(section, id)
      .catch(() => {
        if (!cancelled) setLoadError("Record could not be loaded. Please retry.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, id, findRecord]);
  const googleOn = useFeature("google_integrations");
  const navigate = useNavigate();
  const item =
    section === "integrations"
      ? (s?.items.find((x) => x.id === id) ?? added[section]?.find((x) => x.id === id))
      : added[section]?.find((x) => x.id === id);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [done, setDone] = useState<string[]>([]);
  const [passport, setPassport] = useState<"download" | "share" | null>(null);
  const [view, setView] = useState<"grid" | "table">("table");
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const own =
    section === "integrations" || !!added[section]?.some((x) => x.id === id);
  const isProperty = PROPERTY_SLUGS.includes(section);
  const saved = useRecordLinks(own && section !== "integrations" ? id : "00000000-0000-0000-0000-000000000000");
  if (!item && loadingRecord) return <p className="p-8">Loading record…</p>;
  if (!s || !item) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl">{loadError || "We couldn’t find that record"}</h1>
        <Link
          to="/app"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const isGoogle = section === "integrations" && !!googleConnectorFor[id];
  const shownTabs = tabs.filter(
    (t) => t !== "Items" || section === "rooms" || isProperty,
  );
  if (
    (section === "warranties" || section === "renewals") &&
    added[section]?.some((x) => x.id === id)
  )
    return <TrackingDetail section={section} item={item} />;
  const roomItems =
    section === "rooms"
      ? (added["assets"] ?? []).filter((a) =>
          a.fields.some(([k, v]) => k === "Room" && v.toLowerCase() === item.title.toLowerCase()),
        )
      : [];
  const fv = (a: { fields: [string, string][] }, k: string) =>
    a.fields.find(([f]) => f.toLowerCase() === k)?.[1] ?? "—";
  // Only surface actions that actually work — avoid “not available yet” stubs in production.
  const workingActions = (() => {
    const fromItem = (item.actions ?? []).filter(
      (a) =>
        a !== "Delete" &&
        (/^edit\b/i.test(a) || /^download home report$/i.test(a)),
    );
    if (own && !isGoogle && !isProperty && !fromItem.some((a) => /^edit\b/i.test(a)))
      fromItem.unshift("Edit");
    return fromItem;
  })();
  const act = async (a: string) => {
    if (a === "Delete" && added[section]?.some((x) => x.id === id)) {
      await remove(section, id);
      toast.success("Deleted");
      navigate({ to: "/app/$section", params: { section } });
      return;
    }
    if (/^edit\b/i.test(a)) {
      setEditing(true);
      return;
    }
    if (a === "Download home report") {
      setPassport("download");
      return;
    }
    toast.info("This action is not available yet. No changes were made.");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/app/$section" params={{ section: s.slug }} className="hover:text-foreground">
          {s.title}
        </Link>{" "}
        / <span className="text-foreground">{item.title}</span>
      </nav>

      <section className="rounded-[2rem] bg-midnight-glow p-8 text-midnight-foreground">
        <p className="text-sm text-midnight-foreground/60">{s.title}</p>
        <h1 className="mt-1 font-display text-4xl">{item.title}</h1>
        <p className="mt-2 text-midnight-foreground/70">{item.subtitle}</p>
        {isGoogle ? (
          googleOn ? (
            <GoogleIntegration id={id} />
          ) : (
            <div className="mt-5">
              <Locked name="Google integrations" />
            </div>
          )
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {item.status && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass(item.status[1])}`}
                >
                  {item.status[0]}
                </span>
              )}
              {item.value && <span className="font-display text-2xl">{item.value}</span>}
            </div>
            {(workingActions.length > 0 || own) && (
              <div className="mt-6 flex flex-wrap gap-2">
                {isProperty && own && <PropertyEditButton item={item} />}
                {workingActions.map((a, idx) => (
                    <button
                      key={a}
                      disabled={done.includes(a)}
                      onClick={() => void act(a)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${idx === 0 && !isProperty ? "bg-aurora text-primary-foreground" : "border border-midnight-foreground/20"}`}
                    >
                      {done.includes(a) ? `✓ ${a}` : a}
                    </button>
                  ))}
                {own && section === "documents" && (
                  <>
                    <button
                      onClick={() => {
                        setRenameTitle(item.title);
                        setRenaming(true);
                      }}
                      className="rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold"
                    >
                      Rename
                    </button>
                    {(() => {
                      const arch = item.fields.some(
                        ([k, v]) => k === "Status" && /^archived$/i.test(v),
                      );
                      return (
                        <button
                          onClick={async () => {
                            const fields: [string, string][] = [
                              ...item.fields.filter(([k]) => k !== "Status"),
                              ...(arch ? [] : [["Status", "Archived"] as [string, string]]),
                            ];
                            if (await update(id, { ...item, fields }))
                              toast.success(arch ? "Document restored" : "Document archived", {
                                description: arch
                                  ? undefined
                                  : "It's hidden from Documents unless you tick Show archived.",
                              });
                          }}
                          className="rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold"
                        >
                          {arch ? "Unarchive" : "Archive"}
                        </button>
                      );
                    })()}
                  </>
                )}
                {own && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete “${item.title}”? This can't be undone.`))
                        void act("Delete");
                    }}
                    className="rounded-full border border-destructive/50 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
            {PASSPORT_KINDS[section] && (
              <div className="mt-2 flex flex-wrap gap-2">
                {section !== "my-home" && (
                  <button
                    onClick={() => setPassport("download")}
                    className="rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold"
                  >
                    Download passport
                  </button>
                )}
                <button
                  onClick={() => setPassport("share")}
                  className="rounded-full border border-midnight-foreground/20 px-4 py-2 text-sm font-semibold"
                >
                  Share passport
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {passport && (
        <PassportModal
          open
          mode={passport}
          onClose={() => setPassport(null)}
          section={section}
          item={item}
          added={added}
          owner={profile?.display_name || email || "you"}
        />
      )}
      {editing && !isProperty && (
        <RecordEditor
          section={section}
          item={item}
          {...(s.addFields ? { addFields: s.addFields } : {})}
          title={`Edit ${s.title.replace(/s$/, "").toLowerCase()}`}
          onClose={() => setEditing(false)}
        />
      )}
      {renaming && (
        <AppModal
          title="Rename document"
          description="Choose a clear name so this record is easy to find later."
          onClose={() => !renameBusy && setRenaming(false)}
        >
          <AppModalForm
            onSubmit={async () => {
              const t = renameTitle.trim();
              if (!t) {
                toast.error("Enter a document name");
                return;
              }
              if (t === item.title) {
                setRenaming(false);
                return;
              }
              setRenameBusy(true);
              const ok = await update(id, { ...item, title: t });
              setRenameBusy(false);
              if (ok) {
                toast.success("Document renamed");
                setRenaming(false);
              } else toast.error("Couldn't rename — please try again");
            }}
          >
            <AppModalInput
              value={renameTitle}
              onChange={setRenameTitle}
              placeholder="Document name"
              autoFocus
              maxLength={200}
            />
            <AppModalPrimaryButton disabled={renameBusy}>
              {renameBusy ? "Saving…" : "Save name"}
            </AppModalPrimaryButton>
          </AppModalForm>
        </AppModal>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-full border bg-card p-1">
        {shownTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        {tab === "Overview" && isGoogle && <GoogleOverviewFields id={id} />}
        {tab === "Overview" &&
          !isGoogle &&
          (item.fields.length ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {item.fields.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No details yet. Use the buttons above to get started.
            </p>
          ))}
        {tab === "Overview" &&
          !isGoogle &&
          own &&
          section !== "documents" &&
          (() => {
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
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Source document
                </p>
                <p className="mt-1 font-display text-lg">{l.title}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {rows
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted-foreground">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                </dl>
                <Link
                  to="/app/$section/$id"
                  params={{ section: "documents", id: l.id }}
                  className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  View Source Document
                </Link>
              </div>
            );
          })()}

        {tab === "Items" && isProperty && <PropertyContents propertyId={item.id} />}
        {tab === "Items" && section === "rooms" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {roomItems.length} item(s) recorded in {item.title}
              </p>
              <div className="flex rounded-full border p-0.5 text-xs">
                {(["table", "grid"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {roomItems.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items yet. Use “Add anything → Scan room” and choose this room to fill it.
              </p>
            )}
            {view === "table" && roomItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2">Item</th>
                      <th>Brand</th>
                      <th>Value</th>
                      <th>Purchased</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomItems.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/50">
                        <td className="py-2">
                          <Link
                            to="/app/$section/$id"
                            params={{ section: "assets", id: a.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {a.title}
                          </Link>
                        </td>
                        <td>{fv(a, "brand")}</td>
                        <td>{a.value ?? fv(a, "price")}</td>
                        <td>{fv(a, "purchase date")}</td>
                        <td className="text-xs text-muted-foreground">Saved</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view === "grid" && (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {roomItems.map((a) => (
                  <Link
                    key={a.id}
                    to="/app/$section/$id"
                    params={{ section: "assets", id: a.id }}
                    className="rounded-2xl border p-4 hover:border-primary"
                  >
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Evidence" &&
          (own && section !== "integrations" ? (
            <div className="space-y-4">
              {proposal && (
                <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
                  <p className="font-semibold">Sera found these details in {proposal.file}</p>
                  <p className="text-xs text-muted-foreground">
                    Confirm to add them to this record's Overview. Existing values with the same
                    name are replaced.
                  </p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {proposal.fields.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted-foreground">
                          {k}
                          {item.fields.some(([x]) => x.toLowerCase() === k.toLowerCase())
                            ? " (update)"
                            : " (new)"}
                        </dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={async () => {
                        const keys = new Set(proposal.fields.map(([k]) => k.toLowerCase()));
                        const fields: [string, string][] = [
                          ...item.fields.filter(
                            ([k]) =>
                              !keys.has(k.toLowerCase()) && k !== "Last updated from evidence",
                          ),
                          ...proposal.fields,
                          [
                            "Last updated from evidence",
                            `${proposal.file} · ${new Date().toLocaleDateString("en-GB")}`,
                          ],
                        ];
                        const ok = await update(id, { ...item, fields });
                        if (ok) {
                          toast.success("Overview updated");
                          setProposal(null);
                          setTab("Overview");
                        } else toast.error("Couldn't update — please try again");
                      }}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Confirm & update
                    </button>
                    <button
                      onClick={() => setProposal(null)}
                      className="rounded-full border px-4 py-2 text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <Evidence itemId={id} itemTitle={item.title} onExtract={setProposal} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Evidence attaches to your saved records.
            </p>
          ))}

        {tab === "Related" &&
          (saved === null ? (
            <p className="text-sm text-muted-foreground">Loading linked records…</p>
          ) : saved.length ? (
            <RelatedRecords links={saved} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing linked yet. Records captured together in Add anything are linked
              automatically.
            </p>
          ))}

        {tab === "Activity" &&
          (item.timeline?.length ? (
            <ol className="space-y-4 border-l pl-5">
              {[
                ...item.timeline,
                ...(own && saved
                  ? saved.map(
                      (l) =>
                        [
                          new Date(l.at).toLocaleDateString(),
                          `Linked to ${l.title} (${l.label.toLowerCase()})`,
                        ] as [string, string],
                    )
                  : []),
              ].map(([d, e]) => (
                <li key={d + e} className="relative">
                  <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-aurora" />
                  <p className="text-xs text-muted-foreground">{d}</p>
                  <p className="font-medium">{e}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ))}

        {tab === "AI insight" && (
          <div className="flex gap-3 rounded-2xl bg-secondary p-5">
            <Sparkles className="h-5 w-5 shrink-0 text-violet" />
            <p className="text-sm">
              {item.insight ??
                "Everything looks good here. Your AI team will flag anything that needs you."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function actionToast(a: string, section: string, name: string): [string, string] {
  const l = a.toLowerCase();
  if (l.includes("scan room"))
    return [
      "Room scan ready",
      `Use Add anything → Scan room to let Sera organise what's in ${name}.`,
    ];
  if (l.includes("warranty") || section === "warranties")
    return [
      "Warranty protected",
      "MatrixKeep is watching this warranty and will remind you before it expires.",
    ];
  if (section === "renewals" || l.includes("renew"))
    return [
      "Renewal is being watched",
      "Sera will keep an eye on this date and let you know before action is needed.",
    ];
  if (l.includes("mot") || l.includes("service") || l.includes("booking"))
    return ["Request noted", `Sera has added this to the timeline for ${name}.`];
  if (l.includes("mark") || l.includes("complete") || l.includes("descaled"))
    return ["Maintenance updated", "MatrixKeep will remind you when it's time to act again."];
  if (l.includes("mileage"))
    return ["Vehicle updated", "Sera has added the latest information to its digital passport."];
  if (l.includes("claim"))
    return ["Claim started", "MatrixKeep is gathering the evidence linked to this record."];
  if (l.includes("download") || l.includes("export"))
    return ["Preparing your file", `${name} is being put together for you.`];
  if (l.includes("ai") || l.includes("extraction") || l.includes("run now"))
    return ["Sera is on it", `${name} is being reviewed with your latest records.`];
  if (l.includes("invite") || l.includes("permission"))
    return ["Access updated", "Your team settings have been noted."];
  if (section === "insurance")
    return ["Insurance record updated", "MatrixKeep is tracking the important dates and evidence."];
  if (section === "assets")
    return [
      "Digital passport updated",
      "Your asset is organised and ready for MatrixKeep to track.",
    ];
  return [`${a} noted`, `MatrixKeep has recorded this for ${name}.`];
}
