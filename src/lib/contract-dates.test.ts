import { describe, expect, it } from "vitest";
import {
  deriveContractDates,
  normalizeDateFields,
  parsePeriod,
  resolveSpokenDate,
} from "./contract-dates";

const REF = "2026-10-26"; // Monday
const val = (f: [string, string][], k: string) => f.find(([l]) => l === k)?.[1];

describe("parsePeriod", () => {
  it("parses numeric and word periods, including approx language", () => {
    expect(parsePeriod("12 months")).toEqual({ n: 12, unit: "month" });
    expect(parsePeriod("2 months'")).toEqual({ n: 2, unit: "month" });
    expect(parsePeriod("three years")).toEqual({ n: 3, unit: "year" });
    expect(parsePeriod("Approximately three years")).toEqual({ n: 3, unit: "year" });
    expect(parsePeriod("approx. 3 yrs")).toEqual({ n: 3, unit: "year" });
    expect(parsePeriod("a week")).toEqual({ n: 1, unit: "week" });
    expect(parsePeriod("unknown")).toBeNull();
  });
});

describe("resolveSpokenDate — user speak scenarios", () => {
  it("resolves today / yesterday / tomorrow", () => {
    expect(resolveSpokenDate("today", REF)).toBe("2026-10-26");
    expect(resolveSpokenDate("yesterday", REF)).toBe("2026-10-25");
    expect(resolveSpokenDate("tomorrow", REF)).toBe("2026-10-27");
    expect(resolveSpokenDate("day before yesterday", REF)).toBe("2026-10-24");
  });

  it("resolves last / this / next / bare weekdays (purchase = most recent past)", () => {
    // REF is Sunday 26 Oct 2026; last Friday = 23 Oct
    expect(resolveSpokenDate("last Friday", REF)).toBe("2026-10-23");
    expect(resolveSpokenDate("Friday", REF)).toBe("2026-10-23");
    expect(resolveSpokenDate("last Monday", REF)).toBe("2026-10-19");
    expect(resolveSpokenDate("this Monday", REF)).toBe("2026-10-26");
    expect(resolveSpokenDate("this Friday", REF)).toBe("2026-10-30");
    expect(resolveSpokenDate("next Tuesday", REF)).toBe("2026-10-27");
  });

  it("resolves N units ago / in N units", () => {
    expect(resolveSpokenDate("3 days ago", REF)).toBe("2026-10-23");
    expect(resolveSpokenDate("two weeks ago", REF)).toBe("2026-10-12");
    expect(resolveSpokenDate("a month ago", REF)).toBe("2026-09-26");
    expect(resolveSpokenDate("in 5 days", REF)).toBe("2026-10-31");
  });

  it("resolves specific calendar dates (UK preference)", () => {
    expect(resolveSpokenDate("15 March 2026", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("15th March 2026", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("March 15, 2026", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("15/03/2026", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("15-03-2026", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("2026-03-15", REF)).toBe("2026-03-15");
    expect(resolveSpokenDate("on 15 March 2026", REF)).toBe("2026-03-15");
  });

  it("returns null for non-dates", () => {
    expect(resolveSpokenDate("Pittappillil", REF)).toBeNull();
    expect(resolveSpokenDate("Godrej washing machine", REF)).toBeNull();
  });
});

describe("normalizeDateFields + warranty expiry from speak input", () => {
  it("normalises Purchase date yesterday and derives 3-year Expiry", () => {
    const f = deriveContractDates(
      [
        ["Purchase date", "yesterday"],
        ["Duration", "Approximately three years"],
        ["Term", "Approximately 3 years"],
        ["Brand", "Godrej"],
      ],
      "Expiry date",
      REF,
    );
    expect(val(f, "Purchase date")).toBe("2026-10-25");
    expect(val(f, "Expiry date")).toBe("2029-10-25");
  });

  it("normalises last Friday purchase and absolute dates", () => {
    const f = normalizeDateFields(
      [
        ["Purchase date", "last Friday"],
        ["Invoice date", "15/03/2026"],
        ["Retailer", "Currys"],
      ],
      REF,
    );
    expect(val(f, "Purchase date")).toBe("2026-10-23");
    expect(val(f, "Invoice date")).toBe("2026-03-15");
    expect(val(f, "Retailer")).toBe("Currys");
  });
});

describe("contract date calculation", () => {
  it("derives expiry from start + 12 month term and a 90 day notice deadline", () => {
    const f = deriveContractDates([
      ["Start date", "2026-01-01"],
      ["Term", "12 months"],
      ["Notice period", "90 days"],
    ]);
    expect(val(f, "Renewal date")).toBe("2027-01-01");
    expect(val(f, "Notice deadline")).toBe("2026-10-03");
  });
  it("uses an explicit end date and 3 month notice", () => {
    const f = deriveContractDates([
      ["End date", "2027-12-31"],
      ["Notice period", "3 months"],
    ]);
    expect(val(f, "Renewal date")).toBe("2027-12-31");
    expect(val(f, "Notice deadline")).toBe("2027-09-30");
  });
  it("keeps a stated notice deadline", () => {
    const f = deriveContractDates([
      ["Renewal date", "2027-03-31"],
      ["Notice period", "90 days"],
      ["Notice deadline", "2026-12-31"],
    ]);
    expect(val(f, "Notice deadline")).toBe("2026-12-31");
  });
});

import { legacyText } from "./file-text";
describe("old Office text", () => {
  it("pulls readable UTF-16 text out of binary files", () => {
    const t = "Tenancy ends 2027-10-31";
    const b = new Uint8Array([
      0,
      1,
      2,
      ...Array.from(t).flatMap((c) => [c.charCodeAt(0), 0]),
      0,
      1,
    ]);
    expect(legacyText(b)).toContain(t);
  });
});
