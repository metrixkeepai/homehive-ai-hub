import { describe, it, expect } from "vitest";
import { checkAdd, effective, eligiblePlans } from "./entitlements";

describe("plan entitlements", () => {
  it("free plan allows 3 rooms", () => {
    expect(checkAdd(effective("free"), "rooms", 2).ok).toBe(true);
    expect(checkAdd(effective("free"), "rooms", 3)).toMatchObject({ ok: false, reason: "limit", max: 3 });
  });
  it("free plan locks vehicles", () => { expect(checkAdd(effective("free"), "vehicles", 0)).toMatchObject({ ok: false, reason: "locked" }); });
  it("published config overrides defaults", () => { expect(checkAdd(effective("free", { rooms: { on: true, limit: null } }), "rooms", 50).ok).toBe(true); });
  it("vehicle upgrade suggests Home+ and Family", () => { expect(eligiblePlans("free", "vehicle_passport", {})).toEqual(["plus", "family"]); });
});
