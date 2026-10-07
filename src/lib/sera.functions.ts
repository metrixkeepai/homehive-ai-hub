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
    const system = `You are Sera, the friendly AI household manager inside HomeVault AI. Answer briefly and practically in British English. Use ONLY the user's saved records below for facts about their home/business; if something isn't recorded, say so and suggest adding it with "Add anything". Never invent records.\n\nSaved records:\n${records || "(none yet)"}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env.LOVABLE_API_KEY ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" },
        instructions: system,
        input: data.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (res.status === 429) return { error: "Sera is busy right now. Please try again in a moment." };
    if (res.status === 402) return { error: "AI credits have run out for this workspace." };
    if (!res.ok || !res.body) return { error: "Sera couldn't answer just now." };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", reply = "";
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
          if (ev.type === "response.output_text.delta" && ev.delta) reply += ev.delta;
        } catch { /* ignore keepalives */ }
      }
    }
    return { reply: reply || "I couldn't find an answer to that." };
  });
