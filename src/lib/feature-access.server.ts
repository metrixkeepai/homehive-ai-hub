import { supabaseAdmin } from "@/integrations/supabase/client.server";
export async function requireFeature(userId: string, key: string) {
  const { data, error } = await supabaseAdmin.rpc("feature_enabled", { _user: userId, _key: key });
  if (error || data !== true) throw new Error("This feature is temporarily unavailable.");
}
