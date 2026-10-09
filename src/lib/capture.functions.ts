import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Input } from "./capture.server";
export type { Extracted } from "./capture.server";

export const extractRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { runExtraction } = await import("./capture.server");
    return runExtraction(data, (context as { userId?: string }).userId ?? null);
  });
