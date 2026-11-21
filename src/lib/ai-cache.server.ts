import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import type { Json } from "../integrations/supabase/types";

export async function cachedOperation<T extends Json>(
  user: string,
  workspace: string | null,
  feature: "sera" | "capture" | "video" | "speech",
  version: string,
  inputs: unknown,
  perform: () => Promise<T>,
): Promise<T> {
  const key = createHash("sha256")
    .update(JSON.stringify([user, workspace, feature, version, inputs]))
    .digest("hex");
  const lease = randomUUID();
  const deadline = Date.now() + 110_000;
  let delay = 300;
  while (Date.now() < deadline) {
    const claim = await supabaseAdmin.rpc("claim_ai_request", {
      _key: key,
      _user: user,
      _workspace: workspace,
      _feature: feature,
      _lease: lease,
    });
    if (claim.error) throw new Error("AI request unavailable");
    const state = claim.data as { state: string; result?: T };
    if (state.state === "hit" && state.result !== undefined) return state.result;
    if (state.state === "owner") {
      let result: T;
      try {
        result = await perform();
      } catch (error) {
        await supabaseAdmin.rpc("finish_ai_request", { _key: key, _lease: lease, _result: null });
        throw error;
      }
      const failed = result !== null && typeof result === "object" && "error" in result;
      const saved = await supabaseAdmin.rpc("finish_ai_request", {
        _key: key,
        _lease: lease,
        _result: failed ? null : result,
      });
      if (saved.error) console.error("AI result cache write failed", saved.error.code);
      return result;
    }
    if (state.state !== "pending") throw new Error("Unexpected AI claim state");
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 2000);
  }
  throw new Error("AI operation still processing");
}
