import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { flagOn } from "./features";

/** Feature switches for the signed-in user: keys mapped to on/off. Unknown keys count as on. */
export const myFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: flags }, { data: p }] = await Promise.all([
      supabaseAdmin.from("feature_flags").select("key,enabled,audiences,rollout"),
      context.supabase.from("profiles").select("account_type").eq("id", context.userId).maybeSingle(),
    ]);
    const out: Record<string, boolean> = {};
    for (const f of flags ?? []) out[f.key] = flagOn(f, (p?.account_type as string) ?? "individual", context.userId);
    return out;
  });
