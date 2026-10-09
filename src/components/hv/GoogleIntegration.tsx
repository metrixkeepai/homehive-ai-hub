import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStore, toneClass } from "./store";
import { getGoogleStatus, startGoogleConnect, completeGoogleConnect, disconnectGoogle, syncGmail, syncCalendar, listDriveFiles, importDriveFile, type GoogleConnector } from "@/lib/google.functions";

export const googleConnectorFor: Record<string, GoogleConnector> = { gmail: "google_mail", gcal: "google_calendar", drive: "google_drive" };
const names: Record<GoogleConnector, string> = { google_mail: "Gmail", google_calendar: "Google Calendar", google_drive: "Google Drive" };
const access: Record<GoogleConnector, string> = {
  google_mail: "Read-only. MatrixKeep only imports receipts, invoices, order confirmations, warranties and renewals.",
  google_calendar: "Creates and updates MatrixKeep reminder events in your main calendar.",
  google_drive: "Read-only. Only the files you choose are imported.",
};

function waitForOAuth(popup: Window, connector: string) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => { window.removeEventListener("message", onMsg); window.clearInterval(poll); };
    const onMsg = (e: MessageEvent) => {
      const t = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== connector || (t !== "appUserConnectorOAuthComplete" && t !== "appUserConnectorOAuthFailed")) return;
      cleanup();
      if (t === "appUserConnectorOAuthComplete") resolve(typeof e.data?.code === "string" ? e.data.code : null);
      else { popup.close(); reject(new Error("Google connection failed or was cancelled.")); }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("The Google window was closed before finishing.")); } }, 500);
  });
}

const when = (s: string | null) => s ? new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Never";

export function GoogleIntegration({ id }: { id: string }) {
  const connector = googleConnectorFor[id];
  const qc = useQueryClient();
  const { current } = useStore();
  const status = useQuery({ queryKey: ["google-status"], queryFn: () => getGoogleStatus(), retry: 2 });
  const st = status.data?.[connector];
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<{ id: string; name: string; mimeType: string; size: number; modifiedTime: string }[] | null>(null);
  const [lastLinks, setLastLinks] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["google-status"] });

  const connect = async () => {
    const reconnect = !!st?.connected;
    const popup = window.open("", "matrixkeep-google", "width=600,height=720");
    if (!popup) { toast.error("Your browser blocked the Google window. Allow pop-ups and try again."); return; }
    setBusy("connect");
    try {
      const { authorizationUrl } = await startGoogleConnect({ data: { connector } });
      const done = waitForOAuth(popup, connector);
      popup.location.href = authorizationUrl;
      const code = await done;
      if (code) await completeGoogleConnect({ data: { connector, code } });
      await refresh();
      toast.success(reconnect ? `Reconnected to ${names[connector]}` : `${names[connector]} connected`);
    } catch (e) { popup.close(); toast.error(e instanceof Error ? e.message : "Couldn't connect"); }
    finally { setBusy(null); }
  };
  const disconnect = async () => {
    if (!confirm(`Disconnect ${names[connector]}? Records already imported stay in MatrixKeep.`)) return;
    setBusy("disconnect");
    try { await disconnectGoogle({ data: { connector } }); setFiles(null); await refresh(); toast.success(`${names[connector]} disconnected`); }
    catch { toast.error("Couldn't disconnect. Try again."); } finally { setBusy(null); }
  };
  const handle = async <T extends object>(p: Promise<T | { error: string; reconnectRequired?: boolean }>) => {
    const r = await p;
    if ("error" in r) { toast.error(r.error); await refresh(); return null; }
    return r as T;
  };
  const sync = async () => {
    setBusy("sync");
    try {
      if (connector === "google_mail") {
        const r = await handle(syncGmail({ data: { workspaceId: current.id } }));
        if (r) toast.success(`Checked ${r.checked} new email(s)`, { description: `${r.created} record(s) added to ${current.name}.${r.checked === 8 ? " Press again to check more." : ""}` });
      } else {
        const r = await handle(syncCalendar({ data: { workspaceId: current.id } }));
        if (r) toast.success(`${r.created} reminder(s) added, ${r.updated} updated`, { description: r.skippedNoDate ? `${r.skippedNoDate} record(s) have no date yet.` : undefined });
      }
      await refresh();
    } finally { setBusy(null); }
  };
  const browse = async () => {
    setBusy("browse");
    try { const r = await handle(listDriveFiles({ data: { search } })); if (r) setFiles(r.files); } finally { setBusy(null); }
  };
  const importFile = async (fileId: string) => {
    setBusy(fileId);
    try {
      const r = await handle(importDriveFile({ data: { fileId, workspaceId: current.id } }));
      if (r) { toast.success(`Imported — ${r.created} record(s) added`); setLastLinks(r.firstId); await refresh(); }
    } finally { setBusy(null); }
  };

  const badge: [string, string] = status.isLoading ? ["Checking…", "muted"] : status.isError ? ["Status unavailable", "danger"] : st?.reconnectRequired ? ["Reconnect needed", "warning"] : st?.connected ? ["Connected", "success"] : ["Not connected", "muted"];
  const btn = "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass(badge[1])}`}>{badge[0]}</span></div>
      <div className="mt-6 flex flex-wrap gap-2">
        {(!st?.connected || st.reconnectRequired) && <button disabled={!!busy || status.isLoading} onClick={connect} className={`${btn} bg-aurora text-primary-foreground`}>{busy === "connect" ? "Waiting for Google…" : st?.reconnectRequired ? `Reconnect ${names[connector]}` : "Connect"}</button>}
        {st?.connected && !st.reconnectRequired && connector !== "google_drive" && <button disabled={!!busy} onClick={sync} className={`${btn} bg-aurora text-primary-foreground`}>{busy === "sync" ? "Syncing…" : connector === "google_mail" ? "Sync now" : "Add reminders to calendar"}</button>}
        {st?.connected && !st.reconnectRequired && connector === "google_drive" && <button disabled={!!busy} onClick={browse} className={`${btn} bg-aurora text-primary-foreground`}>{busy === "browse" ? "Loading…" : "Choose files"}</button>}
        {st?.connected && <button disabled={!!busy} onClick={disconnect} className={`${btn} border border-midnight-foreground/20`}>{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</button>}
        {status.isError && <button onClick={() => status.refetch()} className={`${btn} border border-midnight-foreground/20`}>Try again</button>}
      </div>
      {st?.reconnectRequired && <p className="mt-3 text-sm text-midnight-foreground/70">Your Google access needs to be renewed.</p>}
      {/* rendered into the Overview tab via portal-free sibling: parent places this block */}
      <GoogleOverview connector={connector} st={st} workspace={current.name}>
        {connector === "google_drive" && files && (
          <div className="mt-6 space-y-3">
            <div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file names" className="min-w-0 flex-1 rounded-md border bg-card px-3 py-2 text-sm" /><button onClick={browse} disabled={!!busy} className="rounded-full border px-4 py-2 text-sm">Search</button></div>
            {files.length === 0 && <p className="text-sm text-muted-foreground">No PDFs or photos found.</p>}
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.mimeType === "application/pdf" ? "PDF" : "Photo"} · {(f.size / 1024 / 1024).toFixed(1)} MB · {new Date(f.modifiedTime).toLocaleDateString("en-GB")}</p></div>
                <button disabled={!!busy} onClick={() => importFile(f.id)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === f.id ? "Importing…" : "Import"}</button>
              </div>
            ))}
            {lastLinks && <Link to="/app/$section/$id" params={{ section: "documents", id: lastLinks }} className="inline-block text-sm font-medium text-primary">Open the last imported document →</Link>}
          </div>
        )}
      </GoogleOverview>
    </>
  );
}

let overviewSlot: ((n: React.ReactNode) => void) | null = null;
function GoogleOverview(_: { connector: GoogleConnector; st: unknown; workspace: string; children?: React.ReactNode }) { void overviewSlot; return null; }

export function GoogleOverviewFields({ id }: { id: string }) {
  const connector = googleConnectorFor[id];
  const { current } = useStore();
  const status = useQuery({ queryKey: ["google-status"], queryFn: () => getGoogleStatus(), retry: 2 });
  const st = status.data?.[connector];
  const rows: [string, string][] = st?.connected ? [
    ["Account", st.account ?? (st.reconnectRequired ? "Needs reconnecting" : "—")],
    ["Connected since", when(st.since)],
    ["Last sync", when(st.lastSyncAt)],
    [connector === "google_calendar" ? "Reminders sent last sync" : "Records added last sync", String(st.lastSyncCount)],
    ["Imports go to", current.name],
    ["Access", access[connector]],
    ...(st.lastError ? [["Last problem", st.lastError] as [string, string]] : []),
  ] : [["Status", status.isLoading ? "Checking…" : "Not connected"], ["Access when connected", access[connector]], ["Your account", "Each person connects their own Google account. Nobody else in MatrixKeep can use it."]];
  return <dl className="grid gap-4 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}</dl>;
}
