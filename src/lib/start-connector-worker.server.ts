export async function startWorker() {
  if (process.env["APP_ENV"] !== "staging") throw Error("Unexpected worker environment");
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
