import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
});

export const askSera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("home_items").select("section,title,subtitle,fields").order("created_at", { ascending: false }).limit(150);
    const records = (rows ?? []).map((r) => `- [${r.section}] ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""} ${JSON.stringify(r.fields)}`).join("\n");
    const system = `You are Sera, the friendly AI household manager inside MatrixKeep AI. Answer briefly and practically in British English. Use ONLY the user's saved records below for facts about their home/business; if something isn't recorded, say so and suggest adding it with "Add anything". Never invent records.\n\nSaved records:\n${records || "(none yet)"}`;
    const { logAiUsage } = await import("./ai-usage.server");
    const t0 = Date.now();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env['LOVABLE_API_KEY'] ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        instructions: system,
        input: data.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const uid = (context as { userId?: string }).userId ?? null;
    if (!res.ok || !res.body) void logAiUsage({ userId: uid, feature: "sera", model: "openai/gpt-6-astra", input: 0, output: 0, latencyMs: Date.now() - t0, ok: false, error: `HTTP ${res.status}` });
    if (res.status === 429) return { error: "Sera is busy right now. Please try again in a moment." };
    if (res.status === 402) return { error: "AI credits have run out for this workspace." };
    if (!res.ok || !res.body) return { error: "Sera couldn't answer just now." };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", reply = "", usage = { input_tokens: 0, output_tokens: 0 };
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
          if (ev.type === "response.output_text.delta" && ev.delta) reply += ev.delta;
        } catch { /* ignore keepalives */ }
      }
    }
    await logAiUsage({ userId: uid, feature: "sera", model: "openai/gpt-6-astra", input: usage.input_tokens, output: usage.output_tokens, latencyMs: Date.now() - t0, ok: true });
    return { reply: reply || "I couldn't find an answer to that." };
  });
