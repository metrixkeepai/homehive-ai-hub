import { checkStatus, setCheck } from "@/lib/connector-checks.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "./store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function ConnectorChecks({
  provider,
}: {
  provider: "google_mail" | "google_drive" | "outlook" | "onedrive";
}) {
  const { current } = useStore(),
    qc = useQueryClient(),
    scope = { provider, workspaceId: current.id };
  const key = ["connector-check", provider, current.id];
  const status = useQuery({
    queryKey: key,
    queryFn: () => checkStatus({ data: scope }),
    refetchInterval: (q) => (q.state.data?.pending ? 5000 : false),
  });
  const change = useMutation({
    mutationFn: (action: "scan" | "enable" | "disable") => setCheck({ data: { ...scope, action } }),
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["connector-reviews"] });
    },
  });
  return (
    <div className="mt-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={change.isPending || status.data?.pending}
          onClick={() => change.mutate("scan")}
        >
          {status.data?.pending ? "Check queued or running" : "Sync now"}
        </Button>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={status.data?.enabled ?? false}
            disabled={!status.data || change.isPending}
            onChange={(e) => change.mutate(e.target.checked ? "enable" : "disable")}
          />
          Auto-check twice monthly
        </label>
      </div>
      {status.data?.last && (
        <p>
          {status.data.problem ??
            "Last check found " + status.data.found + " new items for review."}{" "}
          · {new Date(status.data.last).toLocaleString()}
        </p>
      )}
    </div>
  );
}
