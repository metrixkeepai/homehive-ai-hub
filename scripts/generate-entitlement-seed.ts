import { plans } from "../src/lib/plans";
import { defaultEntitlements } from "../src/lib/entitlements";
import { writeFileSync } from "node:fs";

// Only rerun before this migration has been applied anywhere. Future catalogue
// changes need a new migration; approved plan versions remain authoritative overrides.
const values = plans.map(
  (plan) =>
    `('${plan.key}', '${JSON.stringify(defaultEntitlements(plan.key)).replaceAll("'", "''")}'::jsonb)`,
);
writeFileSync(
  "drizzle/migrations/0019_entitlement_defaults.sql",
  `-- Generated from the product catalogue; never grant client writes.\nCREATE TABLE public.plan_defaults (plan_key text PRIMARY KEY, entitlements jsonb NOT NULL);\nALTER TABLE public.plan_defaults ENABLE ROW LEVEL SECURITY;\nGRANT ALL ON public.plan_defaults TO service_role;\nINSERT INTO public.plan_defaults VALUES\n${values.join(",\n")};\n`,
);
