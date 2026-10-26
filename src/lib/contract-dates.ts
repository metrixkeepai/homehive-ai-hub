// Deterministic contract/capture date logic: AI may emit spoken or printed dates;
// we normalise to YYYY-MM-DD and calculate derived expiry/renewal/notice dates.
import {
  addDays,
  addMonths,
  addYears,
  format,
  getDay,
  isValid,
  parse,
  parseISO,
  previousDay,
  setDay,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

type F = [string, string][];
type Period = { n: number; unit: "day" | "week" | "month" | "year" };

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

const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  couple: 2,
  few: 3,
};

const DOW: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DATE_LABEL =
  /(^|\b)(date|deadline|expiry|expires|expiration|renewal|purchased|purchase|installed|fitted|effective|service|invoice|due|start|end|mot)(\b|$)/i;

function refDay(referenceDate?: string | Date): Date {
  if (referenceDate instanceof Date && isValid(referenceDate))
    return parseISO(format(referenceDate, "yyyy-MM-dd"));
  if (typeof referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    const d = parseISO(referenceDate);
    if (isValid(d)) return d;
  }
  return parseISO(format(new Date(), "yyyy-MM-dd"));
}

function amount(token: string): number | null {
  const t = token.toLowerCase().replace(/,/g, "");
  if (/^\d+$/.test(t)) return Number(t);
  return WORDS[t] ?? null;
}

/** Parses "12 months", "three years", "approx. 3 yrs", "2 weeks'" → unit + amount. */
export function parsePeriod(v: string): Period | null {
  const s = v
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(approximately|approx\.?|about|around|roughly|nearly|over|~)\b/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = s.match(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|\d+)\s*(day|week|month|year|yr)s?\b/,
  );
  if (!m) return null;
  const n = amount(m[1]!);
  if (!n) return null;
  const unit = m[2] === "yr" ? "year" : (m[2] as Period["unit"]);
  return { n, unit };
}

export function addPeriod(d: Date, p: Period) {
  return p.unit === "day"
    ? addDays(d, p.n)
    : p.unit === "week"
      ? addDays(d, p.n * 7)
      : p.unit === "month"
        ? addMonths(d, p.n)
        : addYears(d, p.n);
}

export function subPeriod(d: Date, p: Period) {
  return p.unit === "day"
    ? subDays(d, p.n)
    : p.unit === "week"
      ? subDays(d, p.n * 7)
      : p.unit === "month"
        ? subMonths(d, p.n)
        : subYears(d, p.n);
}

function parseAbsolute(raw: string): Date | null {
  const s = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(s);
    return d && isValid(d) ? d : null;
  }
  // Prefer UK day-first for numeric forms used in British English product copy.
  const numeric = [
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/,
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/,
  ];
  for (const re of numeric) {
    const m = s.match(re);
    if (!m) continue;
    let dd = Number(m[1]);
    let mm = Number(m[2]);
    let yyyy = Number(m[3]);
    if (yyyy < 100) yyyy += yyyy >= 70 ? 1900 : 2000;
    // If first part can't be a month, treat as D/M/Y; if second can't be a day in UK sense and first ≤12, still D/M/Y.
    if (dd > 31 || mm > 12) {
      // Maybe M/D/Y US form
      if (Number(m[1]) <= 12 && Number(m[2]) <= 31) {
        mm = Number(m[1]);
        dd = Number(m[2]);
      } else return null;
    }
    const isoStr = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const d = parseISO(isoStr);
    if (d && isValid(d) && format(d, "yyyy-MM-dd") === isoStr) return d;
  }
  const formats = [
    "d MMMM yyyy",
    "do MMMM yyyy",
    "d MMM yyyy",
    "do MMM yyyy",
    "MMMM d yyyy",
    "MMM d yyyy",
    "d MMMM yy",
    "d MMM yy",
    "MMMM d yy",
    "MMM d yy",
  ];
  for (const f of formats) {
    const d = parse(s, f, new Date());
    if (isValid(d)) return parseISO(format(d, "yyyy-MM-dd"));
  }
  return null;
}

function weekdayNamed(ref: Date, qualifier: "last" | "this" | "next" | "past", day: number): Date {
  if (qualifier === "last" || qualifier === "past") return previousDay(ref, day);
  if (qualifier === "next") {
    const candidate = setDay(ref, day, { weekStartsOn: 1 });
    if (getDay(ref) === day) return addDays(ref, 7);
    return candidate > ref ? candidate : addDays(candidate, 7);
  }
  // this <weekday> = the weekday in the current Mon–Sun week (today if it is that day)
  const weekStart = startOfWeek(ref, { weekStartsOn: 1 });
  return setDay(weekStart, day, { weekStartsOn: 1 });
}

/**
 * Resolves spoken/relative/printed date phrases to YYYY-MM-DD against a reference day
 * (normally the user's local "today"). Returns null when the phrase is not a date.
 */
export function resolveSpokenDate(
  value: string,
  referenceDate?: string | Date,
): string | null {
  const ref = refDay(referenceDate);
  let s = value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/^(on|the|for|dated|date[:\s]+)\s+/i, "")
    .replace(/\b(approximately|approx\.?|about|around|roughly)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  const absolute = parseAbsolute(s.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1"));
  if (absolute) return format(absolute, "yyyy-MM-dd");

  if (/^today$|^tonight$|^this morning$|^this afternoon$|^this evening$/.test(s))
    return format(ref, "yyyy-MM-dd");
  if (/^tomorrow$/.test(s)) return format(addDays(ref, 1), "yyyy-MM-dd");
  if (/^yesterday$/.test(s)) return format(subDays(ref, 1), "yyyy-MM-dd");
  if (/^day before yesterday$|^the day before yesterday$/.test(s))
    return format(subDays(ref, 2), "yyyy-MM-dd");
  if (/^last week$/.test(s)) return format(subWeeks(ref, 1), "yyyy-MM-dd");
  if (/^next week$/.test(s)) return format(addDays(ref, 7), "yyyy-MM-dd");

  const ago = s.match(
    /^((?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|\d+))\s+(day|week|month|year)s?\s+ago$/,
  );
  if (ago) {
    const p = parsePeriod(`${ago[1]} ${ago[2]}`);
    if (p) return format(subPeriod(ref, p), "yyyy-MM-dd");
  }
  const inFuture = s.match(
    /^in\s+((?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|\d+))\s+(day|week|month|year)s?$/,
  );
  if (inFuture) {
    const p = parsePeriod(`${inFuture[1]} ${inFuture[2]}`);
    if (p) return format(addPeriod(ref, p), "yyyy-MM-dd");
  }

  const named = s.match(
    /^(last|this|next|past)?\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)$/,
  );
  if (named) {
    const day = DOW[named[2]!];
    if (day === undefined) return null;
    const q = (named[1] as "last" | "this" | "next" | "past" | undefined) ?? "past";
    // Bare "Friday" in capture/purchase speech almost always means the most recent past Friday.
    const qualifier = named[1] ? q : "past";
    return format(weekdayNamed(ref, qualifier === "past" ? "last" : qualifier, day), "yyyy-MM-dd");
  }

  return null;
}

/** True when a field label is date-like and should be normalised. */
export function isDateFieldLabel(label: string): boolean {
  return DATE_LABEL.test(label.trim());
}

/** Normalise date-like field values to YYYY-MM-DD where resolvable. */
export function normalizeDateFields(fields: F, referenceDate?: string | Date): F {
  return fields.map(([label, value]) => {
    if (!value.trim() || !isDateFieldLabel(label)) return [label, value];
    if (iso(value)) return [label, value.trim()];
    const resolved = resolveSpokenDate(value, referenceDate);
    return resolved ? [label, resolved] : [label, value];
  });
}

/**
 * Adds derived Renewal/Expiry and Notice deadline when the document doesn't state them.
 * Understands Purchase date / Duration for speak-captured warranties and assets.
 */
export function deriveContractDates(
  fields: F,
  dateKey: "Renewal date" | "Expiry date" = "Renewal date",
  referenceDate?: string | Date,
): F {
  const out: F = normalizeDateFields(fields, referenceDate);
  const has = (k: string) => out.some(([l, v]) => l.toLowerCase() === k.toLowerCase() && v.trim());
  let end = iso(
    get(out, dateKey, "Renewal date", "Expiry date", "End date", "Tenancy end date", "Lease end"),
  );
  if (!end) {
    const start = iso(
      get(
        out,
        "Start date",
        "Effective date",
        "Tenancy start date",
        "Lease start",
        "Purchase date",
        "Service date",
        "Invoice date",
        "Installed date",
        "Fitted date",
      ),
    );
    const term = parsePeriod(
      get(
        out,
        "Term",
        "Fixed term",
        "Lease length",
        "Contract term",
        "Duration",
        "Warranty term",
        "Warranty length",
        "Warranty duration",
        "Cover period",
      ),
    );
    if (start && term) {
      end = addPeriod(start, term);
      if (!has(dateKey)) {
        out.push([dateKey, format(end, "yyyy-MM-dd")]);
        out.push([
          "Date basis",
          dateKey === "Expiry date"
            ? "Calculated from purchase/start date and warranty term"
            : "Calculated from start date and term",
        ]);
      }
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
