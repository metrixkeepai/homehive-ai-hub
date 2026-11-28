import { plans, type PlanDef } from "./plans";
import type { Entitlements } from "./entitlements";
import type { Database } from "../integrations/supabase/types";
type Rows = Database["public"]["Functions"]["effective_plan_catalogue"]["Returns"];
export function resolvePlans(data: Rows) {
  const catalogue = new Map<string, PlanDef>(plans.map((p) => [p.key, p]));
  for (const row of data ?? []) {
    const base = catalogue.get(row.plan_key);
    const cap = {
      users: "",
      places: "",
      assets: "",
      storage: "",
      docs: "",
      captures: "",
      sera: "",
      ...base?.cap,
    };
    if (row.capacity && typeof row.capacity === "object")
      for (const k of Object.keys(cap) as (keyof typeof cap)[]) {
        const value = (row.capacity as Record<string, unknown>)[k];
        if (typeof value === "string") cap[k] = value;
      }
    const entitlements = row.entitlements as Entitlements;
    const limits = { assets: 0, docs: 0, places: 0, users: 0 };
    for (const [slot, feature] of Object.entries({
      assets: "assets",
      docs: "documents",
      places: row.audience === "individual" ? "properties" : "locations",
      users: "users",
    }) as [keyof typeof limits, string][]) {
      const e = entitlements[feature];
      limits[slot] = e
        ? !e.on
          ? 0
          : e.limit === null
            ? Infinity
            : (e.limit ?? base?.limits[slot] ?? 0)
        : (base?.limits[slot] ?? 0);
    }
    const placeLabel = row.audience === "individual" ? "property" : "location";
    for (const [slot, value, singular, plural] of [
      ["places", limits.places, placeLabel, placeLabel === "property" ? "properties" : "locations"],
      ["users", limits.users, "user", "users"],
    ] as const)
      cap[slot] =
        (value === Infinity ? "Unlimited" : value) + " " + (value === 1 ? singular : plural);
    for (const [slot, feature, label] of [
      ["captures", "ai_captures", "AI captures/mo"],
      ["sera", "sera_questions", "Sera questions/mo"],
    ] as const) {
      const e = entitlements[feature];
      if (e && e.limit !== undefined)
        cap[slot] = (e.on ? (e.limit ?? "Unlimited") : 0) + " " + label;
    }
    catalogue.set(row.plan_key, {
      positioning: "",
      outcome: "",
      bestFor: "",
      agents: [],
      support: "",

      ...base,
      limits,
      entitlements,
      key: row.plan_key,
      name: row.name,
      audience: row.audience as PlanDef["audience"],
      monthly: row.monthly,
      yearly: row.yearly,
      cap,
      benefits: row.benefits,
    });
  }
  return [...catalogue.values()];
}
