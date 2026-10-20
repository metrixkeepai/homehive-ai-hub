// Deterministic contract date logic: AI extracts start/term/notice/explicit dates; we calculate the rest.
import {
  addDays,
  addMonths,
  addYears,
  format,
  isValid,
  parseISO,
  subDays,
  subMonths,
} from "date-fns";

type F = [string, string][];
const get = (f: F, ...keys: string[]) => {
  for (const k of keys) {
    const v = f.find(([l]) => l.toLowerCase() === k.toLowerCase())?.[1]?.trim();
    if (v) return v;
  }
  return "";
};
const iso = (v: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseISO(v) : null;
  return d && isValid(d) ? d : null;
};

/** Parses "12 months", "1 year", "90 days", "3 months'", "2 weeks" → a unit + amount. */
export function parsePeriod(
  v: string,
): { n: number; unit: "day" | "week" | "month" | "year" } | null {
  const m = v.toLowerCase().match(/(\d+)\s*(day|week|month|year|yr)s?/);
  if (!m) return null;
  return {
    n: Number(m[1]),
    unit: m[2] === "yr" ? "year" : (m[2] as "day" | "week" | "month" | "year"),
  };
}
export function addPeriod(d: Date, p: NonNullable<ReturnType<typeof parsePeriod>>) {
  return p.unit === "day"
    ? addDays(d, p.n)
    : p.unit === "week"
      ? addDays(d, p.n * 7)
      : p.unit === "month"
        ? addMonths(d, p.n)
        : addYears(d, p.n);
}
export function subPeriod(d: Date, p: NonNullable<ReturnType<typeof parsePeriod>>) {
  return p.unit === "day"
    ? subDays(d, p.n)
    : p.unit === "week"
      ? subDays(d, p.n * 7)
      : p.unit === "month"
        ? subMonths(d, p.n)
        : subMonths(d, p.n * 12);
}

/** Adds derived "Renewal date"/"Expiry date" and "Notice deadline" when the document doesn't state them. */
export function deriveContractDates(
  fields: F,
  dateKey: "Renewal date" | "Expiry date" = "Renewal date",
): F {
  const out: F = fields.map(([k, v]) => [k, v]);
  const has = (k: string) => out.some(([l, v]) => l.toLowerCase() === k.toLowerCase() && v.trim());
  let end = iso(
    get(out, dateKey, "Renewal date", "Expiry date", "End date", "Tenancy end date", "Lease end"),
  );
  if (!end) {
    const start = iso(
      get(out, "Start date", "Effective date", "Tenancy start date", "Lease start"),
    );
    const term = parsePeriod(get(out, "Term", "Fixed term", "Lease length", "Contract term"));
    if (start && term) {
      end = addPeriod(start, term);
      out.push([dateKey, format(end, "yyyy-MM-dd")]);
      out.push(["Date basis", "Calculated from start date and term"]);
    }
  } else if (!has(dateKey)) out.push([dateKey, format(end, "yyyy-MM-dd")]);
  const notice = parsePeriod(get(out, "Notice period", "Notice requirement"));
  if (end && notice && !iso(get(out, "Notice deadline", "Cancellation deadline"))) {
    const deadline = format(subPeriod(end, notice), "yyyy-MM-dd");
    const i = out.findIndex(([l]) => l.toLowerCase() === "notice deadline");
    if (i >= 0) out[i] = ["Notice deadline", deadline];
    else out.push(["Notice deadline", deadline]);
  }
  return out;
}

export const isAutoRenew = (fields: F) =>
  /^y/i.test(get(fields, "Auto-renewal", "Auto renewal", "Auto-renew"));
export const noticeDeadline = (fields: F) =>
  iso(get(fields, "Notice deadline", "Cancellation deadline"));
