// Records each AI call (tokens, latency, outcome) for the Super Admin cost views. Never throws.
export async function logAiUsage(e: {
  userId: string | null;
  feature: string;
  model: string;
  input: number;
  output: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
  audioSeconds?: number;
  workspaceId?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rates: Record<string, [number, number]> = {
      "gpt-6-luna": [0.1, 0.5],
      "gpt-6.1-sol": [2, 10],
    };
    const rate = rates[e.model];
    const { error } = await supabaseAdmin.from("ai_usage_log").insert({
      user_id: e.userId,
      feature: e.feature,
      model: e.model,
      input_tokens: e.input,
      output_tokens: e.output,
      audio_seconds: e.audioSeconds ?? 0,
      workspace_id: e.workspaceId ?? null,
      cost_usd:
        e.model === "gpt-transcribe"
          ? ((e.audioSeconds ?? 0) / 60) * 0.0045
          : rate
            ? (e.input * rate[0] + e.output * rate[1]) / 1_000_000
            : 0,
      latency_ms: e.latencyMs,
      ok: e.ok,
      error: e.error ?? null,
    });
    if (error) console.error(JSON.stringify({ event: "ai_usage_log_failed", code: error.code }));
  } catch {
    console.error(JSON.stringify({ event: "ai_usage_log_failed" }));
  }
}
