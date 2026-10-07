import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECTIONS = ["assets", "rooms", "documents", "warranties", "vehicles", "maintenance", "tasks", "insurance"] as const;

const Input = z.object({
  mode: z.string().max(40),
  text: z.string().max(8000).default(""),
  image: z.string().max(7_000_000).optional(), // data URL
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

export const extractRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const instructions = `You are HomeVault's capture agent. The user used "${data.mode}". Extract every distinct real-world record (items/assets, rooms, receipts/documents, warranties, vehicles, maintenance jobs, tasks, insurance policies) you can see or read. For a room photo list each visible item as an asset with a "Room" field. For a receipt create a document record AND one asset per purchased product with Brand, Model, Price, Purchase date, Retailer where known, plus a warranty record if a warranty term is stated. Use British English and £. Never invent values you cannot see — omit those fields. Keep titles short. Maximum 15 records. Return JSON.`;
    const content: unknown[] = [{ type: "input_text", text: (data.text || "(no text provided)") + (data.fileName ? `\nFile name: ${data.fileName}` : "") }];
    if (data.image) content.push({ type: "input_image", image_url: data.image });
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" }, instructions,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "records", strict: true, schema } },
      }),
    });
    if (res.status === 429) return { error: "The AI is busy. Please try again in a moment." };
    if (res.status === 402) return { error: "AI credits have run out for this workspace." };
    if (!res.ok || !res.body) return { error: "The AI couldn't read that. Please try again." };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim()) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        } catch { /* keepalive */ }
      }
    }
    try {
      const j = JSON.parse(out) as { summary: string; records: Extracted[] };
      return { summary: j.summary, records: j.records.slice(0, 15) };
    } catch {
      return { error: "The AI returned something unreadable. Please try again." };
    }
  });
