import { scanBudget, ScanBudgetReached } from "../src/lib/ai-meter.server";
import { db, requireConnectorPlan } from "../src/lib/connector-review.server";
import { scanGmail, scanDrive } from "../src/lib/google-scan.server";
import { scanOutlook, scanOneDrive } from "../src/lib/ms-connector.server";
import { markConnection } from "../src/server/appUserConnections.server";
if (
  process.env.APP_ENV !== "staging" ||
  process.env.SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co"
)
  throw Error("Unexpected staging configuration");
const end = Date.now() + 15 * 60000;
const budget = { remaining: 8, bytes: 24 * 1024 * 1024 };
for (let batch = 0; batch < 8 && budget.remaining > 0 && Date.now() < end; batch++) {
  const r = await db.rpc("claim_connector_check");
  if (r.error) throw Error("Worker could not claim a check.");
  const k = r.data?.[0];
  if (!k) break;
  let problem: string | null = null,
    more = false,
    created = 0;
  let examined: number | null = null,
    candidates: number | null = null,
    duplicates: number | null = null;
  try {
    await requireConnectorPlan(k.user_id, k.provider);
    if (k.workspace_id) {
      const scope = await db
        .from("workspaces")
        .select("id")
        .eq("id", k.workspace_id)
        .eq("owner_id", k.user_id)
        .single();
      if (!scope.data) throw Error("Workspace unavailable.");
    }
    const s = { user: k.user_id, ws: k.workspace_id, provider: k.provider };
    const result = await scanBudget.run(budget, async () =>
      k.provider === "google_mail"
        ? scanGmail(s.user, s.ws)
        : k.provider === "google_drive"
          ? scanDrive(s.user, s.ws)
          : k.provider === "outlook"
            ? scanOutlook(s)
            : scanOneDrive(s),
    );
    examined = "checked" in result ? Number(result.checked) : null;
    candidates = "candidates" in result ? Number(result.candidates) : null;
    duplicates = "alreadyImported" in result ? Number(result.alreadyImported) : null;
    more = result.more;
    created = result.created;
  } catch (e) {
    if (e instanceof ScanBudgetReached) {
      more = true;
      budget.remaining = 0;
    } else {
      const message = e instanceof Error ? e.message : "";
      const safeProblems = [
        "Extraction unavailable. Retry the scan.",
        "File changed.",
        "Unsupported or incomplete attachment",
        "Could not save checkpoint.",
        "Review unavailable",
        "RECONNECT",
      ];
      const safeProviderStatus = /^(Microsoft|Google) request failed \([45]\d{2}\)\.?$/.test(
        message,
      );
      problem =
        safeProblems.includes(message) || safeProviderStatus
          ? message
          : "The check could not finish. Verify your connection and plan, then retry.";
    }
  }
  const saved = await db
    .from("connector_checks")
    .update({
      lease: null,
      leased_until: null,
      last_checked: new Date().toISOString(),
      last_found: created,
      last_problem: problem,
      ...(more ? { requested: true } : {}),
    })
    .eq("id", k.id)
    .eq("lease", k.lease);
  if (saved.error) throw Error("Could not settle scan.");
  const metrics = await db.from("connector_scan_runs").insert({
    user_id: k.user_id,
    workspace_id: k.workspace_id,
    provider: k.provider,
    success: !problem,
    examined,
    candidates,
    duplicates,
    prepared: created,
  });
  if (metrics.error) throw Error("Could not record scan metrics.");
  await markConnection(k.user_id, k.provider, {
    last_sync_count: created,
    last_error: problem,
    ...(!problem ? { last_sync_at: new Date().toISOString() } : {}),
  });
}
