import { expect, test } from "vitest";
import { resolvePlans } from "./effective-plans";

test("approved Home terms drive rendered allowances and billing across versions", () => {
  const row = {
    plan_key: "home",
    name: "Home revised",
    audience: "individual",
    monthly: 5,
    yearly: 50,
    capacity: { captures: "100 AI captures/mo" },
    benefits: ["Published benefit"],
    entitlements: {
      ai_captures: { on: true, limit: 73 },
      assets: { on: true, limit: 200 },
      sera_voice_minutes: { on: true, limit: 30 },
    },
  };
  const resolve = (limit: number) =>
    resolvePlans([
      { ...row, entitlements: { ...row.entitlements, ai_captures: { on: true, limit } } },
    ]).find((p) => p.key === "home");
  expect(resolve(73)).toMatchObject({
    name: "Home revised",
    monthly: 5,
    yearly: 50,
    limits: { assets: 200 },
    cap: { captures: "73 AI captures/mo" },
  });
  expect(resolve(26)?.cap.captures).toBe("26 AI captures/mo");
  expect(resolve(26)?.entitlements?.["sera_voice_minutes"]?.limit).toBe(30);
});
