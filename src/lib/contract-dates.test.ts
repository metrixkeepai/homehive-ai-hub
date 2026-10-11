import { describe, expect, it } from "vitest";
import { deriveContractDates, parsePeriod } from "./contract-dates";

const val = (f: [string, string][], k: string) => f.find(([l]) => l === k)?.[1];

describe("contract date calculation", () => {
  it("derives expiry from start + 12 month term and a 90 day notice deadline", () => {
    const f = deriveContractDates([["Start date", "2026-01-01"], ["Term", "12 months"], ["Notice period", "90 days"]]);
    expect(val(f, "Renewal date")).toBe("2027-01-01");
    expect(val(f, "Notice deadline")).toBe("2026-10-03");
  });
  it("uses an explicit end date and 3 month notice", () => {
    const f = deriveContractDates([["End date", "2027-12-31"], ["Notice period", "3 months"]]);
    expect(val(f, "Renewal date")).toBe("2027-12-31");
    expect(val(f, "Notice deadline")).toBe("2027-09-30");
  });
  it("keeps a stated notice deadline", () => {
    const f = deriveContractDates([["Renewal date", "2027-03-31"], ["Notice period", "90 days"], ["Notice deadline", "2026-12-31"]]);
    expect(val(f, "Notice deadline")).toBe("2026-12-31");
  });
  it("parses periods", () => {
    expect(parsePeriod("2 months'")).toEqual({ n: 2, unit: "month" });
    expect(parsePeriod("unknown")).toBeNull();
  });
});
