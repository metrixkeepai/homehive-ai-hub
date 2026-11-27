import { OperationFailure } from "./ai-operation-error";
import { operationMeter, scanBudget } from "./ai-meter.server";
import { supabaseAdmin } from "../integrations/supabase/client.server";

export async function reserveOperation(
  userId: string,
  workspaceId: string | null,
  feature: "capture" | "video" | "sera" | "speech" | "voice" | "share" | "report",
  units = 1,
  estimate?: number,
) {
  const reserve = () =>
    supabaseAdmin.rpc(estimate === undefined ? "reserve_operation" : "reserve_ai_operation", {
      _user: userId,
      _workspace: workspaceId as string,
      _feature: feature,
      _units: units,
      ...(estimate === undefined ? {} : { _estimate: estimate }),
    });
  let { data, error } = await reserve();
  if (scanBudget.getStore() && error?.message === "Rate limit reached") {
    // Background scans share the user’s rolling minute allowance with interactive captures.
    await new Promise((resolve) => setTimeout(resolve, 61000));
    ({ data, error } = await reserve());
  }
  if (error || !data) throw new OperationFailure(error?.message ?? "", "reserve");
  const meter = operationMeter.getStore();
  if (meter) meter.reservation = data;
  return data;
}

export async function reserveQualityRetry(userId: string, id: string, estimate: number) {
  const { error } = await supabaseAdmin.rpc("reserve_ai_retry", {
    _user: userId,
    _id: id,
    _estimate: estimate,
  });
  if (error) throw new OperationFailure(error.message, "retry");
}
