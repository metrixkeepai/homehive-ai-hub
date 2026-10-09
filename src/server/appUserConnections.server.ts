import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export type ConnectionRow = { connector_id: string; reconnect_required: boolean; last_sync_at: string | null; last_sync_count: number; last_error: string | null; created_at: string };

export async function saveConnectionKeyForUser(userId: string, connectorId: string, connectionAPIKey: string) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    { user_id: userId, connector_id: connectorId, connection_key_ciphertext: encryptConnectionKey(connectionAPIKey), reconnect_required: false, last_error: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const db = await admin();
  const { data, error } = await db.from("app_user_connections").select("connection_key_ciphertext").eq("user_id", userId).eq("connector_id", connectorId).maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function listConnectionsForUser(userId: string): Promise<ConnectionRow[]> {
  const db = await admin();
  const { data, error } = await db.from("app_user_connections").select("connector_id,reconnect_required,last_sync_at,last_sync_count,last_error,created_at").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ConnectionRow[];
}

export async function markConnection(userId: string, connectorId: string, patch: Partial<Omit<ConnectionRow, "connector_id" | "created_at">>) {
  const db = await admin();
  await db.from("app_user_connections").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("connector_id", connectorId);
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const db = await admin();
  await db.from("app_user_connections").delete().eq("user_id", userId).eq("connector_id", connectorId);
  await db.from("google_sync_links").delete().eq("user_id", userId).eq("connector_id", connectorId);
}

export async function getLinks(userId: string, connectorId: string, externalIds: string[]) {
  if (!externalIds.length) return new Map<string, { item_id: string | null; google_id: string | null }>();
  const db = await admin();
  const { data } = await db.from("google_sync_links").select("external_id,item_id,google_id").eq("user_id", userId).eq("connector_id", connectorId).in("external_id", externalIds);
  return new Map((data ?? []).map((r) => [r.external_id, { item_id: r.item_id, google_id: r.google_id }]));
}

export async function saveLink(userId: string, connectorId: string, externalId: string, itemId: string | null, googleId: string | null) {
  const db = await admin();
  await db.from("google_sync_links").upsert(
    { user_id: userId, connector_id: connectorId, external_id: externalId, item_id: itemId, google_id: googleId, updated_at: new Date().toISOString() },
    { onConflict: "user_id,connector_id,external_id" },
  );
}
