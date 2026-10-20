import { logAiUsage } from "./ai-usage.server";

// Verified against https://developers.openai.com/api/docs/models on 2026-10-13.
// Do not silently accept arbitrary models or gateways from client input.
export const AI_MODELS = {
  standard: "gpt-6-luna",
  escalation: "gpt-6.1-sol",
  speech: "gpt-transcribe",
  realtime: "gpt-realtime-2.1",
} as const;
export const textRates: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6.1-sol": { input: 2, output: 10 },
};
export function openAIKey() {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("OpenAI is not configured.");
  return key;
}
export class AIProviderError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(
      status === 429
        ? "The AI is busy. Please try again in a moment."
        : "The AI could not complete this request. Please try again.",
    );
    this.status = status;
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
    await response.body?.cancel();
    throw new AIProviderError(response.status);
  }
  return response;
}
export async function responseText(options: {
  userId: string;
  feature: string;
  instructions: string;
  input: unknown;
  format?: unknown;
  escalate?: boolean;
  maxOutput?: number;
}) {
  const model = options.escalate ? AI_MODELS.escalation : AI_MODELS.standard;
  const started = Date.now();
  try {
    const response = await openAIRequest(
      "responses",
      JSON.stringify({
        model,
        store: false,
        stream: false,
        max_output_tokens: Math.min(options.maxOutput ?? 2048, 6000),
        reasoning: { effort: options.escalate ? "low" : "none" },
        instructions: options.instructions,
        input: options.input,
        ...(options.format ? { text: { format: options.format } } : {}),
      }),
      "application/json",
    );
    const data = (await response.json()) as {
      status?: string;
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (data.status !== "completed") throw new AIProviderError(502);
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
      latencyMs: Date.now() - started,
      ok: true,
    });
    return text;
  } catch (error) {
    await logAiUsage({
      userId: options.userId,
      feature: options.feature,
      model,
      input: 0,
      output: 0,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof AIProviderError ? `HTTP ${error.status}` : "request_failed",
    });
    throw error;
  }
}
