import { Locked } from "./Feature";
import { ConnectorChecks } from "./ConnectorChecks";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { msStatus, msStart, msFinish, msDisconnect, msBrowse, msImport } from "@/lib/ms.functions";
import { useStore } from "./store";
import { ConnectorReviews } from "./GoogleIntegration";
import {
  ConnectorBadge,
  ConnectorFields,
  DriveBrowser,
  connectorButton as btn,
  when,
  type DriveFile,
} from "./ConnectorPresentation";
import { toast } from "sonner";
type Provider = "outlook" | "onedrive";
function consent(popup: Window, url: string) {
  return new Promise<{ code: string; state: string }>((resolve, reject) => {
    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== popup ||
        event.data?.type !== "matrixkeep-microsoft-consent"
      )
        return;
      cleanup();
      if (event.data.state !== new URL(url).searchParams.get("state") || !event.data.code)
        reject(Error("Microsoft consent was cancelled."));
      else resolve(event.data);
    };
    const timer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(Error("Microsoft consent window closed."));
      }
    }, 600);
    window.addEventListener("message", receive);
    popup.location.href = url;
  });
}
export function MicrosoftIntegration({ provider }: { provider: Provider }) {
  const qc = useQueryClient(),
    status = useQuery({ queryKey: ["ms-status"], queryFn: () => msStatus() });
  const [busy, setBusy] = useState(false);
  const grant = status.data?.connections.find((c) => c.connector_id === provider);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ms-status"] }),
        qc.invalidateQueries({ queryKey: ["connector-reviews"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microsoft connector unavailable.");
    } finally {
      setBusy(false);
    }
  }
  function connect() {
    const p = window.open("", "matrixkeep-microsoft", "width=600,height=720");
    if (!p) {
      toast.error("Allow pop-ups to connect.");
      return;
    }
    void run(async () => {
      try {
        const url = await msStart({ data: { provider, origin: location.origin } });
        const { code, state } = await consent(p, url);
        await msFinish({ data: { provider, state, code } });
      } finally {
        p.close();
      }
    });
  }
  if (!status.data) return <p>{status.isError ? "Status unavailable" : "Checking…"}</p>;
  if (!grant && !status.data.eligible[provider])
    return <Locked name={provider === "onedrive" ? "OneDrive" : "Outlook"} />;
  return (
    <>
      <ConnectorBadge
        label={
          grant?.reconnect_required ? "Reconnect needed" : grant ? "Connected" : "Not connected"
        }
        tone={grant?.reconnect_required ? "warning" : grant ? "success" : "muted"}
      />
      <div className="mt-6 flex flex-wrap gap-2">
        {(!grant || grant.reconnect_required) && (
          <button
            className={`${btn} bg-aurora text-primary-foreground`}
            disabled={busy || !status.data.configured || !status.data.eligible[provider]}
            onClick={connect}
          >
            {!status.data.configured
              ? "Setup required"
              : !status.data.eligible[provider]
                ? "Plan upgrade required"
                : grant
                  ? "Reconnect"
                  : "Connect"}
          </button>
        )}
        {grant && (
          <button
            className={`${btn} border border-midnight-foreground/20`}
            disabled={busy}
            onClick={() => {
              if (confirm("Disconnect this account? Saved records stay in MatrixKeep."))
                void run(async () => {
                  await msDisconnect({ data: provider });
                });
            }}
          >
            Disconnect
          </button>
        )}
      </div>
      {grant && !grant.reconnect_required && <ConnectorChecks provider={provider} />}
      {grant?.reconnect_required && (
        <p className="mt-3 text-sm text-midnight-foreground/70">
          Your Microsoft access needs to be renewed.
        </p>
      )}
    </>
  );
}
export function MicrosoftOverviewFields({ provider }: { provider: Provider }) {
  const status = useQuery({ queryKey: ["ms-status"], queryFn: () => msStatus() });
  const { current } = useStore();
  const grant = status.data?.connections.find((c) => c.connector_id === provider);
  const access =
    provider === "outlook"
      ? "Read-only. MatrixKeep checks relevant Outlook messages and attachments for receipts, invoices, warranties, renewals and other records. Selected content may be sent to OpenAI for extraction and is presented for review before saving."
      : "Read-only. Choose files or opt in to checks for new documents. Selected files may be sent to OpenAI for extraction and are presented for review before saving.";
  const rows: [string, string][] = grant
    ? [
        ["Account", "Connected Microsoft account"],
        ["Connected since", when(grant.created_at)],
        ["Last sync", when(grant.last_sync_at)],
        ["Items prepared last check", String(grant.last_sync_count)],
        ["Imports go to", current.name],
        ["Access", access],
      ]
    : [
        [
          "Status",
          status.isLoading ? "Checking…" : status.isError ? "Status unavailable" : "Not connected",
        ],
        ["Access when connected", access],
        [
          "Your account",
          "Each person connects their own Microsoft account. Nobody else in MatrixKeep can use it.",
        ],
      ];
  if (grant?.last_error) rows.push(["Last problem", grant.last_error]);
  return (
    <>
      <ConnectorFields rows={rows} />
      {(grant || status.data?.eligible[provider]) && <ConnectorReviews provider={provider} />}
      {provider === "onedrive" && grant && <OneDriveBrowser key={grant.created_at} />}
    </>
  );
}
function OneDriveBrowser() {
  const { current } = useStore();
  const qc = useQueryClient();
  const [files, setFiles] = useState<DriveFile[] | null>(null),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  async function perform(fileId?: string) {
    setBusy(fileId ?? "browse");
    try {
      if (fileId) {
        const n = await msImport({
          data: { provider: "onedrive", workspaceId: current.id, fileId },
        });
        toast.success(n ? n + " ready for review" : "No new items in this batch.");
        await qc.invalidateQueries({ queryKey: ["connector-reviews"] });
      } else setFiles(await msBrowse({ data: search }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microsoft connector unavailable.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <DriveBrowser
      name="OneDrive"
      files={files}
      search={search}
      onSearch={setSearch}
      onBrowse={() => void perform()}
      onImport={(id) => void perform(id)}
      busy={busy}
    />
  );
}
