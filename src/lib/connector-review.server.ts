import { connectorAllowed } from "./connector-entitlements";
export { connectorAllowed } from "./connector-entitlements";
import { connectorAttribution, scanBudget, ScanBudgetReached } from "./ai-meter.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "node:crypto";
import { runExtraction } from "./capture.server";
export const db: SupabaseClient = supabaseAdmin;
export type Attachment = {
  name: string;
  mime: string;
  size: number;
  fileId?: string;
  message?: string;
  attachmentId?: string;
  hash?: string;
};
export type Scope = { user: string; ws: string | null; provider: string };
export function scoped(table: string, s: Scope) {
  const q = db.from(table).select("*").eq("user_id", s.user).eq("provider", s.provider);
  return s.ws ? q.eq("workspace_id", s.ws) : q.is("workspace_id", null);
}
export const fingerprint = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export const eligible = (a: Attachment) =>
  a.size > 0 && a.size <= 4800000 && /^(application\/pdf|image\/(png|jpeg|webp))$/.test(a.mime);
export async function queue(
  s: Scope,
  key: string,
  title: string,
  source: string[][],
  text: string,
  a?: Attachment,
  bytes?: Buffer,
) {
  if (a && (!bytes || !eligible(a) || bytes.length !== a.size))
    throw Error("Unsupported or incomplete attachment");
  const found = await scoped("connector_reviews", s).eq("external_key", key).maybeSingle();
  if (found.error) throw Error("Review queue unavailable");
  if (found.data) return 0;
  const contentHash = fingerprint(bytes ?? Buffer.from(text.trim()));
  let prior = db
    .from("connector_reviews")
    .select("id")
    .eq("user_id", s.user)
    .eq("content_hash", contentHash)
    .eq("extraction_version", "capture-v1-luna-sol-schema1");
  prior = s.ws ? prior.eq("workspace_id", s.ws) : prior.is("workspace_id", null);
  const duplicate = await prior.limit(1);
  if (duplicate.error) throw Error("Duplicate check unavailable");
  if (duplicate.data?.length) return 0;
  const budget = scanBudget.getStore();
  if (budget) {
    const size = bytes?.length ?? Buffer.byteLength(text);
    if (budget.remaining < 1 || size > budget.bytes) throw new ScanBudgetReached();
    budget.remaining--;
    budget.bytes -= size;
  }
  const result = await connectorAttribution.run(s.provider, () =>
    runExtraction(
      {
        workspaceId: s.ws,
        mode: a ? "Upload document" : "Import email",
        text: a ? "" : text.slice(0, 9000),
        ...(a && bytes ? { image: "data:" + a.mime + ";base64," + bytes.toString("base64") } : {}),
      },
      s.user,
    ),
  );
  if ("error" in result) throw Error("Extraction unavailable. Retry the scan.");
  const records = result.records;
  const { error } = await db.from("connector_reviews").upsert(
    {
      user_id: s.user,
      workspace_id: s.ws,
      provider: s.provider,
      external_key: key,
      content_hash: contentHash,
      extraction_version: "capture-v1-luna-sol-schema1",
      title: title.slice(0, 200),
      source: [...source, ["Found on", new Date().toISOString()]],
      proposals: records,
      attachment: a && bytes ? { ...a, hash: fingerprint(bytes) } : null,
      state: records.length ? "pending" : "rejected",
    },
    { onConflict: "user_id,workspace_id,provider,external_key", ignoreDuplicates: true },
  );
  if (error?.code === "23505") return 0;
  if (error) throw Error("Couldn't prepare review");
  return records.length ? 1 : 0;
}

export async function requireConnectorPlan(user: string, connector: string) {
  const { data, error } = await db.rpc("account_entitlements", { _user: user });
  if (error || !connectorAllowed(data, connector))
    throw Error("This connector is unavailable on the current plan.");
}
