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
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: system }, ...data.messages] }),
    });
    if (res.status === 429) return { error: "Sera is busy right now. Please try again in a moment." };
    if (res.status === 402) return { error: "AI credits have run out for this workspace." };
    if (!res.ok) return { error: "Sera couldn't answer just now." };
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: j.choices?.[0]?.message?.content ?? "" };
  });
