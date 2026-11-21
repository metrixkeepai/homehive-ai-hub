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
  cached?: number;
  cacheWrites?: number;
  promptVersion?: string;
  processingMode?: string;
  audioSeconds?: number;
  workspaceId?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_usage_log").insert({
      user_id: e.userId,
      feature: e.feature,
      model: e.model,
      input_tokens: e.input,
      output_tokens: e.output,
      audio_seconds: e.audioSeconds ?? 0,
      workspace_id: e.workspaceId ?? null,
      usage_details: {
        accounting_version: 1,
        cached_tokens: e.cached ?? 0,
        cache_write_tokens: e.cacheWrites ?? 0,
        processing_mode: e.processingMode ?? "default",
        prompt_version: e.promptVersion ?? e.feature + "-v1",
      },
      latency_ms: e.latencyMs,
      ok: e.ok,
      error: e.error ?? null,
    });
    if (error) console.error(JSON.stringify({ event: "ai_usage_log_failed", code: error.code }));
  } catch {
    console.error(JSON.stringify({ event: "ai_usage_log_failed" }));
  }
}
