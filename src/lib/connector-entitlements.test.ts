import { expect, it } from "vitest";
import { connectorAllowed } from "./connector-entitlements";
import { defaultEntitlements } from "./entitlements";

it.each([
  ["free", false, false, false],
  ["home", true, true, false],
  ["plus", true, true, true],
  ["family", true, true, true],
  ["business_starter", false, false, false],
  ["business", true, false, true],
  ["business_pro", true, true, true],
] as const)("resolves the five connectors for %s", (plan, mail, files, calendar) => {
  const ent = defaultEntitlements(plan);
  expect(
    ["google_mail", "outlook", "google_drive", "onedrive", "google_calendar"].map((provider) =>
      connectorAllowed(ent, provider),
    ),
  ).toEqual([mail, mail, files, files, calendar]);
});

it("respects a published provider override and denies unknown connectors", () => {
  const ent = { ...defaultEntitlements("plus"), outlook: { on: false }, onedrive: { on: false } };
  expect(connectorAllowed(ent, "outlook")).toBe(false);
  expect(connectorAllowed(ent, "onedrive")).toBe(false);
  expect(connectorAllowed(ent, "unknown")).toBe(false);
});
