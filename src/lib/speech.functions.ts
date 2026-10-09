import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  audio: z.string().min(10).max(14_000_000), // base64, no data: prefix
  mime: z.string().max(80),
});

const GW = "https://ai.gateway.lovable.dev/v1";

async function readSse(body: ReadableStream<Uint8Array>, onEvent: (ev: Record<string, unknown>) => void) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      try { onEvent(JSON.parse(l.slice(5).trim()) as Record<string, unknown>); } catch { /* keepalive */ }
    }
  }
}

function fail(status: number) {
  if (status === 429) return { error: "The AI is busy. Please try again in a moment." };
  if (status === 402) return { error: "AI credits have run out for this workspace." };
  return { error: "We couldn't understand that recording. Please try again." };
}

/** Speech in any language → English text (transcribe, then translate/clean). */
export const transcribeToEnglish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"] ?? "";
    const uid = (context as { userId?: string }).userId ?? null;
    const { logAiUsage } = await import("./ai-usage.server");
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const type = data.mime.split(";")[0] || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";

    // 1) Transcribe in the spoken language (auto-detect)
    const t0 = Date.now();
    const form = new FormData();
    form.append("model", "openai/gpt-transcribe");
    form.append("file", new File([bytes], `speech.${ext}`, { type: type.replace("video/", "audio/") }));
    form.append("response_format", "json");
    form.append("stream", "true");
    const tr = await fetch(`${GW}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" }, body: form });
    if (!tr.ok || !tr.body) {
      void logAiUsage({ userId: uid, feature: "speak-transcribe", model: "openai/gpt-transcribe", input: 0, output: 0, latencyMs: Date.now() - t0, ok: false, error: `HTTP ${tr.status}` });
      return fail(tr.status);
    }
    let original = "", deltas = "";
    await readSse(tr.body, (ev) => {
      if (ev["type"] === "transcript.text.delta" && typeof ev["delta"] === "string") deltas += ev["delta"];
      if (ev["type"] === "transcript.text.done" && typeof ev["text"] === "string") original = ev["text"];
    });
    original = (original || deltas).trim();
    void logAiUsage({ userId: uid, feature: "speak-transcribe", model: "openai/gpt-transcribe", input: 0, output: 0, latencyMs: Date.now() - t0, ok: true });
    if (!original) return { error: "We didn't catch anything. Please try speaking again." };

    // 2) Detect language and produce clean English
    const t1 = Date.now();
    const res = await fetch(`${GW}/responses`, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        instructions: "You receive a speech transcript in any language. Detect its language (ISO 639-1 code). Return `english`: if it is not English, a faithful British English translation; if it is English, the same text lightly cleaned (punctuation, capitalisation, remove filler words). Keep brand, shop and product names as proper English names (e.g. Currys, Samsung). Write amounts with the currency symbol and digits (e.g. £1,300). Never add facts that were not said.",
        input: [{ role: "user", content: [{ type: "input_text", text: original }] }],
        text: { format: { type: "json_schema", name: "english", strict: true, schema: { type: "object", additionalProperties: false, required: ["language", "english"], properties: { language: { type: "string" }, english: { type: "string" } } } } },
      }),
    });
    if (!res.ok || !res.body) {
      void logAiUsage({ userId: uid, feature: "speak-translate", model: "openai/gpt-6-astra", input: 0, output: 0, latencyMs: Date.now() - t1, ok: false, error: `HTTP ${res.status}` });
      return fail(res.status);
    }
    let out = "", usage = { input_tokens: 0, output_tokens: 0 };
    await readSse(res.body, (ev) => {
      if (ev["type"] === "response.output_text.delta" && typeof ev["delta"] === "string") out += ev["delta"];
      const r = ev["response"] as { usage?: typeof usage } | undefined;
      if (ev["type"] === "response.completed" && r?.usage) usage = r.usage;
    });
    void logAiUsage({ userId: uid, feature: "speak-translate", model: "openai/gpt-6-astra", input: usage.input_tokens, output: usage.output_tokens, latencyMs: Date.now() - t1, ok: true });
    try {
      const j = JSON.parse(out) as { language: string; english: string };
      return { english: j.english.trim(), language: j.language, original };
    } catch {
      return { error: "We couldn't understand that recording. Please try again." };
    }
  });
