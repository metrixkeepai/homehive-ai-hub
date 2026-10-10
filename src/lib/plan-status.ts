import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Plans deactivated by Super Admin are hidden from new customers (existing subscribers keep theirs).
export function useInactivePlans() {
  const q = useQuery({ queryKey: ["plan-status"], queryFn: async () => { const { data } = await supabase.from("plan_status").select("plan_key").eq("active", false); return (data ?? []).map((r) => r.plan_key); }, staleTime: 60_000 });
  return new Set(q.data ?? []);
}
