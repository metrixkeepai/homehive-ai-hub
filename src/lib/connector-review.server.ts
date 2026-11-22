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
  const result = await runExtraction(
    {
      workspaceId: s.ws,
      mode: a ? "Upload document" : "Import email",
      text: a ? "" : text.slice(0, 9000),
      ...(a && bytes ? { image: "data:" + a.mime + ";base64," + bytes.toString("base64") } : {}),
    },
    s.user,
  );
  if ("error" in result) throw Error("Extraction unavailable. Retry the scan.");
  const records = result.records;
  const { error } = await db.from("connector_reviews").upsert(
    {
      user_id: s.user,
      workspace_id: s.ws,
      provider: s.provider,
      external_key: key,
      title: title.slice(0, 200),
      source: [...source, ["Found on", new Date().toISOString()]],
      proposals: records,
      attachment: a && bytes ? { ...a, hash: fingerprint(bytes) } : null,
      state: records.length ? "pending" : "rejected",
    },
    { onConflict: "user_id,workspace_id,provider,external_key", ignoreDuplicates: true },
  );
  if (error) throw Error("Couldn't prepare review");
  return records.length ? 1 : 0;
}

export async function requireConnectorPlan(user: string, connector: string) {
  const { data, error } = await db.rpc("account_entitlements", { _user: user });
  const email = connector === "google_mail" || connector === "outlook",
    calendar = connector === "google_calendar";
  const keys = calendar
    ? ["google_calendar", "calendar_integration"]
    : email
      ? ["gmail", "email_integration"]
      : ["google_drive", "bulk_imports"];
  if (error || !keys.some((k) => data?.[k]?.on === true))
    throw Error("This connector is unavailable on the current plan.");
}
