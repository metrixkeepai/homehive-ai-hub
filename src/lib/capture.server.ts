import { z } from "zod";

const SECTIONS = ["assets", "rooms", "documents", "warranties", "vehicles", "maintenance", "tasks", "insurance"] as const;

export const Input = z.object({
  mode: z.string().max(40),
  text: z.string().max(8000).default(""),
  image: z.string().max(7_000_000).optional(), // data URL
  images: z.array(z.string().max(1_500_000)).max(8).optional(), // video frames
  fileName: z.string().max(200).optional(),
});

export type Extracted = { section: (typeof SECTIONS)[number]; title: string; subtitle: string; fields: { label: string; value: string }[] };

const schema = {
  type: "object", additionalProperties: false, required: ["summary", "records"],
  properties: {
    summary: { type: "string" },
    records: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["section", "title", "subtitle", "fields"],
        properties: {
          section: { type: "string", enum: [...SECTIONS] },
          title: { type: "string" },
          subtitle: { type: "string" },
          fields: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } } },
        },
      },
    },
  },
};

export async function runExtraction(data: z.infer<typeof Input>, userId: string | null): Promise<{ summary: string; records: Extracted[] } | { error: string }> {
    const instructions = `You are MatrixKeep's capture agent. The user used "${data.mode}". Extract every distinct real-world record (items/assets, rooms, receipts/documents, warranties, vehicles, maintenance jobs, tasks, insurance policies) you can see or read. For a room photo list each visible item as an asset with a "Room" field. For a receipt create a document record AND one asset per purchased product with Brand, Model, Price, Purchase date, Retailer where known, plus a warranty record if a warranty term is stated. Write record text in the language the user wrote their note in (British English if none); use the currency shown, else £. Never invent values you cannot see — omit those fields. Keep titles short. Maximum 15 records. Return JSON.`;
    const content: unknown[] = [{ type: "input_text", text: (data.text || "(no text provided)") + (data.fileName ? `\nFile name: ${data.fileName}` : "") }];
    if (data.image) content.push({ type: "input_image", image_url: data.image });
    if (data.images?.length) {
      content.push({ type: "input_text", text: `The following ${data.images.length} images are frames from one video walkthrough, in order. Count each physical item once even if it appears in several frames.` });
      for (const f of data.images) content.push({ type: "input_image", image_url: f });
    }
    const { logAiUsage } = await import("./ai-usage.server");
    const t0 = Date.now();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" }, instructions,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "records", strict: true, schema } },
      }),
    });
    const uid = userId;
    if (!res.ok || !res.body) void logAiUsage({ userId: uid, feature: "capture", model: "openai/gpt-6-astra", input: 0, output: 0, latencyMs: Date.now() - t0, ok: false, error: `HTTP ${res.status}` });
    if (res.status === 429) return { error: "The AI is busy. Please try again in a moment." };
    if (res.status === 402) return { error: "AI credits have run out for this workspace." };
    if (!res.ok || !res.body) return { error: "The AI couldn't read that. Please try again." };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "", usage = { input_tokens: 0, output_tokens: 0 };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim()) as { type?: string; delta?: string; response?: { usage?: { input_tokens: number; output_tokens: number } } };
          if (ev.type === "response.completed" && ev.response?.usage) usage = ev.response.usage;
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        } catch { /* keepalive */ }
      }
    }
    await logAiUsage({ userId: uid, feature: "capture", model: "openai/gpt-6-astra", input: usage.input_tokens, output: usage.output_tokens, latencyMs: Date.now() - t0, ok: true });
    try {
      const j = JSON.parse(out) as { summary: string; records: Extracted[] };
      return { summary: j.summary, records: j.records.slice(0, 15) };
    } catch {
      return { error: "The AI returned something unreadable. Please try again." };
    }
  }
