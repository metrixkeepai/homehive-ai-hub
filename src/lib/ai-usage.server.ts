// Records each AI call (tokens, latency, outcome) for the Super Admin cost views. Never throws.
export async function logAiUsage(e: { userId: string | null; feature: string; model: string; input: number; output: number; latencyMs: number; ok: boolean; error?: string }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_log").insert({
      user_id: e.userId, feature: e.feature, model: e.model, input_tokens: e.input, output_tokens: e.output,
      latency_ms: e.latencyMs, ok: e.ok, error: e.error ?? null,
    });
  } catch (err) { console.error("ai usage log failed", err); }
}
