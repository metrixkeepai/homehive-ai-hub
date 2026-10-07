import { describe, expect, it } from "vitest";
import { trackingDate, trackingStatus } from "./tracking";
import { accountNavigation } from "./navigation";
import type { Item } from "./data";

const record = (date: string, status = "Active"): Item => ({ id: "check", title: "Cover", subtitle: "", fields: [["Expiry date", date], ["Status", status]] });
describe("date-based tracking", () => {
  const now = new Date(2026, 9, 7);
  it("calculates expired, today, soon and active states", () => {
    expect(trackingStatus(record("2026-10-01"), now).bucket).toBe("overdue");
    expect(trackingStatus(record("2026-10-07"), now).label).toBe("Due today");
    expect(trackingStatus(record("2026-11-06"), now).bucket).toBe("soon");
    expect(trackingStatus(record("2026-11-07"), now).bucket).toBe("active");
  });
  it("handles missing dates and archived records", () => {
    expect(trackingDate(record("not a date"))).toBeNull();
    expect(trackingStatus(record(""), now).bucket).toBe("missing");
    expect(trackingStatus(record("2026-10-01", "Archived"), now).bucket).toBe("archived");
  });
});
describe("workspace navigation", () => {
  it("keeps renewals in both menus and only shows organisation sections in business", () => {
    const slugs = (business: boolean) => accountNavigation(business).flatMap((g) => g.items.map((i) => i.section.slug));
    expect(slugs(false)).toContain("renewals");
    expect(slugs(false)).toContain("family");
    expect(slugs(false)).not.toContain("team");
    expect(slugs(true)).toEqual(expect.arrayContaining(["locations", "team", "roles", "renewals"]));
    expect(slugs(true)).not.toContain("family");
  });
});