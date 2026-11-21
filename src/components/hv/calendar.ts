import type { Item } from "./data";

export type CalEvent = {
  key: string;
  date: string;
  label: string;
  title: string;
  slug: string;
  itemId: string;
  propertyId: string | null;
  kind: string;
};

/** Field labels that represent a future obligation worth putting on the calendar. */
const DATE_LABEL =
  /(expiry|expires|renewal|notice|due|next service|service date|inspection|deadline|end date|mot|review date|maintenance date)/i;
const KIND: Record<string, string> = {
  warranties: "Warranty",
  renewals: "Renewal",
  insurance: "Insurance",
  maintenance: "Maintenance",
  tasks: "Task",
  documents: "Document",
  vehicles: "Vehicle",
  assets: "Asset",
  services: "Service",
};

/** Builds calendar events from saved records: every ISO (YYYY-MM-DD) date in an obligation-type field. Archived records are skipped. */
export function eventsFrom(added: Record<string, Item[]>): CalEvent[] {
  const out: CalEvent[] = [];
  for (const [slug, list] of Object.entries(added)) {
    for (const i of list) {
      if (i.fields.some(([k, v]) => k === "Status" && /^(archived|superseded)$/i.test(v))) continue;
      for (const [k, v] of i.fields) {
        if (!DATE_LABEL.test(k) || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) continue;
        out.push({
          key: `${i.id}-${k}`,
          date: v.trim(),
          label: k,
          title: i.title,
          slug,
          itemId: i.id,
          propertyId: i.propertyId ?? null,
          kind: KIND[slug] ?? "Record",
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function toIcs(events: CalEvent[]) {
  const d = (s: string) => s.replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const next = (s: string) => {
    const x = new Date(`${s}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + 1);
    return x.toISOString().slice(0, 10);
  };
  const body = events.map((e) =>
    [
      "BEGIN:VEVENT",
      `UID:${e.key}@matrixkeep.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${d(e.date)}`,
      `DTEND;VALUE=DATE:${d(next(e.date))}`,
      `SUMMARY:${esc(`${e.title} — ${e.label}`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n"),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MatrixKeep//Calendar//EN",
    ...body,
    "END:VCALENDAR",
  ].join("\r\n");
}
