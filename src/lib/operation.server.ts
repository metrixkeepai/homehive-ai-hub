import { supabaseAdmin } from "../integrations/supabase/client.server";

export async function reserveOperation(
  userId: string,
  workspaceId: string | null,
  feature: "capture" | "video" | "sera" | "speech" | "voice" | "share" | "report",
  units = 1,
) {
  const { data, error } = await supabaseAdmin.rpc("reserve_operation", {
    _user: userId,
    _workspace: workspaceId,
    _feature: feature,
    _units: units,
  });
  if (error || !data)
    throw new Error("This operation is unavailable or its quota has been reached.");
  return data;
}
