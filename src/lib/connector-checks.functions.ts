import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
const keys = z.object({
  workspaceId: z.string().uuid().nullable(),
  provider: z.enum(["google_mail", "google_drive", "onedrive", "outlook"]),
});
export const checkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => keys.parse(d))
  .handler(async ({ data, context }) => {
    const { scoped } = await import("./connector-review.server");
    const r = await scoped("connector_checks", {
      user: context.userId,
      ws: data.workspaceId,
      provider: data.provider,
    }).maybeSingle();
    if (r.error) throw Error("Could not load scan status.");
    return {
      enabled: r.data?.auto_check === true,
      pending: !!(r.data?.requested || Date.parse(r.data?.leased_until) > Date.now()),
      found: Number(r.data?.last_found ?? 0),
      last: r.data?.last_checked as string | null,
      problem: r.data?.last_problem as string | null,
    };
  });
export const setCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    keys.extend({ action: z.enum(["enable", "disable", "scan"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, requireConnectorPlan } = await import("./connector-review.server");
    if (data.action !== "disable") await requireConnectorPlan(context.userId, data.provider);
    if (data.workspaceId) {
      const r = await context.supabase.rpc("can_access_workspace", {
        _workspace: data.workspaceId,
      });
      if (r.error || !r.data) throw Error("Workspace unavailable.");
    }
    if (data.action !== "scan") {
      const r = await db.from("connector_checks").upsert(
        {
          user_id: context.userId,
          workspace_id: data.workspaceId,
          provider: data.provider,
          auto_check: data.action === "enable",
        },
        { onConflict: "user_id,workspace_id,provider" },
      );
      if (r.error) throw Error("Connect first, then try again.");
      return;
    }
    if (process.env["APP_ENV"] !== "staging") throw Error("Connector worker is unavailable.");
    const claimed = await db.rpc("enqueue_connector_check", {
      _user: context.userId,
      _workspace: data.workspaceId,
      _provider: data.provider,
    });
    if (claimed.error) throw Error("Connect first, then try again.");
    if (claimed.data) {
      const r = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(4000) },
      );
      if (!r.ok) throw Error("Queued for the scheduled worker.");
      const { access_token } = await r.json();
      const run = await fetch(
        "https://run.googleapis.com/v2/projects/matrixkeep-staging/locations/europe-west2/jobs/matrixkeep-staging-connector-worker:run",
        {
          method: "POST",
          headers: { authorization: "Bearer " + access_token, "content-type": "application/json" },
          body: "{}",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!run.ok) throw Error("Request queued. The scheduled worker will retry.");
    }
  });
