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

import { resolvePlans } from "./effective-plans";
import { planByKey } from "./plans";
import type { QueryClient } from "@tanstack/react-query";
export function usePublishedPlans() {
  const query = useQuery({
    queryKey: ["published-plan-catalogue"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("effective_plan_catalogue");
      if (error) throw error;
      return resolvePlans(data ?? []);
    },
  });
  return query;
}

export function useCurrentPlan(key?: string | null) {
  const catalogue = usePublishedPlans();
  return catalogue.data?.find((p) => p.key === key) ?? planByKey(key);
}
export async function refreshPlans(client: QueryClient) {
  await Promise.all(
    [["admin", "plans"], ["published-plan-catalogue"], ["plan-status"]].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}
