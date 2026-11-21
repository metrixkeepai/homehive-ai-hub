import { supabaseAdmin } from "../integrations/supabase/client.server";

export async function reserveOperation(
  userId: string,
  workspaceId: string | null,
  feature: "capture" | "video" | "sera" | "speech" | "voice" | "share" | "report",
  units = 1,
  estimate?: number,
) {
  const { data, error } = await supabaseAdmin.rpc(
    estimate === undefined ? "reserve_operation" : "reserve_ai_operation",
    {
      _user: userId,
      _workspace: workspaceId as string,
      _feature: feature,
      _units: units,
      ...(estimate === undefined ? {} : { _estimate: estimate }),
    },
  );
  if (error || !data)
    throw new Error("This operation is unavailable or its quota has been reached.");
  return data;
}

export async function reserveQualityRetry(userId: string, id: string, estimate: number) {
  const { error } = await supabaseAdmin.rpc("reserve_ai_retry", {
    _user: userId,
    _id: id,
    _estimate: estimate,
  });
  if (error) throw new Error("AI retry budget unavailable");
}
