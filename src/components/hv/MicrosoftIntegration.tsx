import { ConnectorChecks } from "./ConnectorChecks";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { msStatus, msStart, msFinish, msDisconnect, msBrowse, msImport } from "@/lib/ms.functions";
import { useStore } from "./store";
import { ConnectorReviews } from "./GoogleIntegration";
import { Button } from "@/components/ui/button";
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
    { current } = useStore(),
    status = useQuery({ queryKey: ["ms-status"], queryFn: () => msStatus() });
  const [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [files, setFiles] = useState<{ id: string; name: string }[]>([]);
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
  function sync(fileId?: string) {
    void run(async () => {
      const n = await msImport({ data: { provider, workspaceId: current.id, fileId } });
      toast.success(n ? n + " ready for review" : "No new items in this batch.");
    });
  }
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Connecting gives MatrixKeep read access to this service. Relevant content can be sent to
          OpenAI for extraction. You review proposed records before saving.
        </p>
        <Button
          disabled={busy || !status.data?.configured || !status.data.eligible[provider]}
          onClick={connect}
        >
          {status.data && !status.data.configured
            ? "Setup required"
            : status.data && !status.data.eligible[provider]
              ? "Plan upgrade required"
              : grant
                ? "Reconnect"
                : "Connect"}
        </Button>
        {grant && (
          <>
            <Button
              disabled={busy}
              onClick={() => {
                if (confirm("Disconnect this account? Saved records stay in MatrixKeep."))
                  void run(async () => {
                    await msDisconnect({ data: provider });
                    setFiles([]);
                  });
              }}
            >
              Disconnect
            </Button>
            {!grant.reconnect_required && <ConnectorChecks provider={provider} />}
          </>
        )}
      </div>
      {grant && provider === "onedrive" && (
        <div className="space-y-2">
          <input
            className="rounded border bg-card p-2 text-foreground"
            aria-label="Search OneDrive files"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            disabled={busy}
            onClick={() => void run(async () => setFiles(await msBrowse({ data: search })))}
          >
            Browse
          </Button>
          {files.map((f) => (
            <div key={f.id}>
              {f.name}{" "}
              <Button disabled={busy} onClick={() => sync(f.id)}>
                Import for review
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConnectorReviews provider={provider} />
    </div>
  );
}
