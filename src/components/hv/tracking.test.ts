import { describe, expect, it } from "vitest";
import { trackingDate, trackingStatus } from "./tracking";
import { accountNavigation } from "./navigation";
import type { Item } from "./data";

const record = (date: string, status = "Active"): Item => ({
  id: "check",
  title: "Cover",
  subtitle: "",
  fields: [
    ["Expiry date", date],
    ["Status", status],
  ],
});
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
    const slugs = (business: boolean) =>
      accountNavigation(business).flatMap((g) => g.items.map((i) => i.section.slug));
    expect(slugs(false)).toContain("renewals");
    expect(slugs(false)).toContain("family");
    expect(slugs(false)).not.toContain("team");
    expect(slugs(true)).toEqual(expect.arrayContaining(["locations", "team", "roles", "renewals"]));
    expect(slugs(true)).not.toContain("family");
  });
});
import { sectionLimit } from "./store";
describe("plan limits", () => {
  it("free plan caps assets at 50", () => {
    expect(sectionLimit("assets", "free")?.max).toBe(50);
  });
  it("free plan caps documents at 10", () => {
    expect(sectionLimit("documents", "free")?.max).toBe(10);
  });
  it("enterprise is uncapped", () => {
    expect(sectionLimit("assets", "enterprise")).toBeNull();
  });
});

import { flagOn } from "@/lib/features";
describe("feature switches", () => {
  it("off switch locks", () => {
    expect(flagOn({ enabled: false, audiences: [], rollout: 100 }, "individual", "u1")).toBe(false);
  });
  it("audience mismatch locks", () => {
    expect(
      flagOn({ enabled: true, audiences: ["business"], rollout: 100 }, "individual", "u1"),
    ).toBe(false);
  });
  it("on for matching audience at 100%", () => {
    expect(flagOn({ enabled: true, audiences: ["business"], rollout: 100 }, "business", "u1")).toBe(
      true,
    );
  });
});
