import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";
import { Link } from "@tanstack/react-router";
import type { Item } from "./data";
type Ref = { id: string; section: string; title: string; fields?: [string, string][] };
function observations(
  section: string,
  item: Item,
  links: Ref[],
  today: string,
  files: number | undefined,
) {
  const fields = new Map(item.fields.map(([k, v]) => [k.toLowerCase().trim(), v.trim()]));
  const facts: { text: string; ref?: Ref }[] = [];
  const iso = (s?: string) =>
    s &&
    /^\d{4}-\d\d-\d\d$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
      ? s
      : null;
  for (const [key, label] of [
    ["notice deadline", "The saved document gives a notice deadline of"],
    ["renewal date", "The saved renewal date is"],
    ["expiry date", "The recorded cover ends on"],
  ]) {
    const date = iso(fields.get(key!));
    if (date) {
      const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
      facts.push({
        text:
          label +
          " " +
          new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
            new Date(date),
          ) +
          " (" +
          (days === 0
            ? "today"
            : days > 0
              ? "in " + days + " days"
              : Math.abs(days) + " days ago") +
          ")." +
          (key === "notice deadline" ? " Check the original wording before acting." : ""),
      });
    }
  }
  const amt = (s?: string) => {
    const m = /^(£|GBP ?)\s*(\d+(?:\.\d{1,2})?)$/.exec(s ?? "");
    return m ? Number(m[2]) : null;
  };
  const previous = amt(fields.get("previous premium")),
    current = amt(fields.get("current premium") ?? fields.get("premium"));
  if (previous && current !== null && previous !== current)
    facts.push({
      text:
        "The recorded premium " +
        (current > previous ? "rose" : "fell") +
        " from £" +
        previous +
        " to £" +
        current +
        " (" +
        Math.abs(((current - previous) / previous) * 100).toFixed(1) +
        "%).",
    });
  const doc = links.find((l) => l.section === "documents"),
    w = links.find((l) => l.section === "warranties");
  if (doc) facts.push({ text: "A source document is linked to this record.", ref: doc });
  if (files)
    facts.push({
      text:
        files === 1
          ? "One evidence file is available in the Evidence tab."
          : files + " evidence files are available in the Evidence tab.",
    });
  const warrantyEnd = w?.fields?.find(([key]) => /^(expiry date|end date)$/i.test(key))?.[1];
  if (w && iso(warrantyEnd))
    facts.push({
      text:
        "The linked warranty records an expiry date of " +
        new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
          new Date(warrantyEnd!),
        ) +
        ".",
      ref: w,
    });
  else if (w)
    facts.push({ text: "You have a linked warranty to consult for coverage details.", ref: w });
  if (section === "assets" && !fields.get("serial number"))
    facts.push({
      text: "Adding the serial number could help identify this asset for a repair or claim.",
    });
  if (section === "assets" && files === 0 && !doc && !w)
    facts.push({
      text: "No receipt or warranty is linked. Adding them would strengthen the ownership evidence.",
    });
  return facts.slice(0, 5);
}
export function RecordInsight({
  item,
  section,
  links,
}: {
  item: Item;
  section: string;
  links: Ref[] | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { email, current } = useStore();
  const docIds = (links ?? [])
    .filter((l) => l.section === "documents")
    .map((l) => l.id)
    .sort();
  const evidence = useQuery({
    queryKey: ["insight-evidence", email, current.id, item.id, docIds],
    enabled: !!links,
    refetchOnMount: "always",
    queryFn: async () => {
      const r = await supabase
        .from("evidence_files")
        .select("id,name,created_at")
        .in("item_id", [item.id, ...docIds])
        .order("id");
      if (r.error) throw Error("Evidence unavailable");
      return r.data;
    },
  });
  // The query key fingerprints the facts used to compute the observations and the date of each countdown.
  const query = useQuery({
    queryKey: [
      "record-insight-v2",
      email,
      current.id,
      item.id,
      section,
      item.fields,
      item.insight,
      links,
      evidence.data,
      today,
    ],
    enabled: !!links && !evidence.isPending,
    staleTime: Infinity,
    queryFn: () => observations(section, item, links ?? [], today, evidence.data?.length),
  });
  const facts = query.data ?? [];
  if (!links || query.isPending) return <p className="text-sm">Checking linked records…</p>;
  return facts.length ? (
    <ul className="space-y-2 text-sm">
      {facts.map(({ text, ref }) => (
        <li key={text}>
          {text}
          {ref && (
            <>
              {" "}
              <Link
                className="text-primary underline"
                to="/app/$section/$id"
                params={{ section: ref.section, id: ref.id }}
              >
                {ref.title}
              </Link>
            </>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm">
      {item.insight ??
        "Not enough information yet. Add a receipt, warranty or other evidence to this record."}
    </p>
  );
}
