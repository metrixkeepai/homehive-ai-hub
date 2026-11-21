import { describe, expect, it } from "vitest";
import { eventsFrom } from "./calendar";

describe("calendar events", () => {
  it("collects obligation dates, keeps property and skips archived records", () => {
    const ev = eventsFrom({
      warranties: [
        {
          id: "w1",
          propertyId: "p1",
          title: "Dishwasher",
          subtitle: "",
          fields: [
            ["Expiry date", "2027-03-01"],
            ["Purchase date", "2024-03-01"],
          ],
        },
      ],
      renewals: [
        {
          id: "r1",
          title: "Old contract",
          subtitle: "",
          fields: [
            ["Renewal date", "2027-01-01"],
            ["Status", "Archived"],
          ],
        },
      ],
    });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ date: "2027-03-01", propertyId: "p1", kind: "Warranty" });
  });
});
