import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Plans deactivated by Super Admin are hidden from new customers (existing subscribers keep theirs).
export function useInactivePlans() {
  const q = useQuery({
    queryKey: ["plan-status"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_status").select("plan_key").eq("active", false);
      return (data ?? []).map((r) => r.plan_key);
    },
    staleTime: 60_000,
  });
  return new Set(q.data ?? []);
}

import { plans, type PlanDef } from "./plans";
export function usePublishedPlans() {
  const query = useQuery({
    queryKey: ["published-plan-catalogue"],
    staleTime: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("published_plan_catalogue");
      if (error) throw error;
      const catalogue = new Map(plans.map((p) => [p.key, p]));
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
        catalogue.set(row.plan_key, {
          positioning: "",
          outcome: "",
          bestFor: "",
          agents: [],
          support: "",
          limits: { assets: 0, users: 0, places: 0, docs: 0 },
          ...base,
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
    },
  });
  return query;
}
