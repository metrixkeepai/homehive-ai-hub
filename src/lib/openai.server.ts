import { logAiUsage } from "./ai-usage.server";

// Verified against https://developers.openai.com/api/docs/models on 2026-10-13.
// Do not silently accept arbitrary models or gateways from client input.
export const AI_MODELS = {
  standard: "gpt-6-luna",
  escalation: "gpt-6.1-sol",
  speech: "gpt-transcribe",
  realtime: "gpt-realtime-2.1",
} as const;
export function openAIKey() {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OpenAI is not configured.");
  return key;
}
export class AIProviderError extends Error {
  readonly status: number;
  readonly providerCode: string | undefined;
  constructor(status: number, providerCode?: string) {
    super(
      status === 429
        ? providerCode === "rate_limit_exceeded"
          ? "The AI request rate limit was reached. Please try again shortly."
          : providerCode && providerCode !== "unknown_429"
            ? "AI usage is limited by the API account. Please contact support."
            : "The AI provider limited this request. Please try again or contact support."
        : "The AI could not complete this request. Please try again.",
    );
    this.status = status;
    this.providerCode = providerCode;
  }
}
export async function openAIRequest(
  path: "responses" | "audio/transcriptions",
  body: BodyInit,
  contentType?: string,
) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIKey()}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
    signal: AbortSignal.timeout(45_000),
    redirect: "error",
  });
  if (!response.ok) {
    // Retain only recognised operational codes. Provider messages can include submitted content.
    const failure = await response.json().catch(() => null);
    const code = failure?.error?.code ?? failure?.error?.type;
    const known = [
      "insufficient_quota",
      "rate_limit_exceeded",
      "billing_hard_limit_reached",
      "usage_limit_reached",
      "project_budget_exceeded",
      "organization_budget_exceeded",
      "organization_usage_limit_exceeded",
      "credits_exhausted",
    ];
    const providerCode = known.includes(code)
      ? String(code)
      : response.status === 429
        ? "unknown_429"
        : undefined;
    throw new AIProviderError(response.status, providerCode);
  }
  return response;
}
export async function responseText(options: {
  userId: string;
  feature: string;
  instructions: string;
  input: unknown;
  format?: unknown;
  workspaceId?: string | null;
  promptVersion?: string;
  escalate?: boolean;
  maxOutput?: number;
}) {
  const model = options.escalate ? AI_MODELS.escalation : AI_MODELS.standard;
  const started = Date.now();
  const promptVersion = options.promptVersion ?? options.feature + "-v1";
  let usage:
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      }
    | undefined;
  try {
    const response = await openAIRequest(
      "responses",
      JSON.stringify({
        model,
        service_tier: "default",
        prompt_cache_key: "matrixkeep-" + promptVersion,
        store: false,
        stream: false,
        max_output_tokens: Math.min(options.maxOutput ?? 2048, 6000),
        reasoning: { effort: options.escalate ? "low" : "none" },
        input: [
          { role: "developer", content: options.instructions },
          ...(Array.isArray(options.input)
            ? options.input
            : [{ role: "user", content: options.input }]),
        ],
        ...(options.format ? { text: { format: options.format } } : {}),
      }),
      "application/json",
    );
    const data = (await response.json()) as {
      status?: string;
      incomplete_details?: { reason?: string };
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: typeof usage;
    };
    usage = data.usage;
    if (data.status !== "completed")
      throw new AIProviderError(
        502,
        data.incomplete_details?.reason === "max_output_tokens" ? "output_limit" : undefined,
      );
    const text =
      data.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("") ?? "";
    if (!text || text.length > 100_000) throw new AIProviderError(502);
    await logAiUsage({
      userId: options.userId,
      feature: options.feature,
      model,
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
      workspaceId: options.workspaceId ?? null,
      cached: usage?.input_tokens_details?.cached_tokens ?? 0,
      cacheWrites: usage?.input_tokens_details?.cache_write_tokens ?? 0,
      promptVersion,
      latencyMs: Date.now() - started,
      ok: true,
    });
    return text;
  } catch (error) {
    await logAiUsage({
      userId: options.userId,
      feature: options.feature,
      model,
      input: usage?.input_tokens ?? 0,
      output: usage?.output_tokens ?? 0,
      workspaceId: options.workspaceId ?? null,
      cached: usage?.input_tokens_details?.cached_tokens ?? 0,
      cacheWrites: usage?.input_tokens_details?.cache_write_tokens ?? 0,
      promptVersion,
      latencyMs: Date.now() - started,
      ok: false,
      error:
        error instanceof AIProviderError
          ? [`HTTP ${error.status}`, error.providerCode].filter(Boolean).join(" ")
          : "request_failed",
    });
    throw error;
  }
}
