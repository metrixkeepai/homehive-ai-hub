import { createFileRoute } from "@tanstack/react-router";

// Plain HTML landing page for the Google consent popup. Only a one-time code is passed to the opener;
// the opener exchanges it through an authenticated server function.
export const Route = createFileRoute("/api/oauth/google/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const connectorId = (url.searchParams.get("connector_id") ?? "").replace(/[^\w]/g, "").slice(0, 40);
        const code = url.searchParams.get("code") ?? "";
        const success = url.searchParams.get("success") === "true";
        const offline = url.searchParams.get("offline_access_allowed");
        const error = url.searchParams.get("error");
        const result = success && offline === "false" ? { success: true, connectorId, code: null }
          : success && code ? { success: true, connectorId, code }
          : { success: false, connectorId, error: error ?? (success ? "Missing code" : "Google connection was cancelled") };
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const safeJson = JSON.stringify(result).replace(/</g, "\\u003c");
        const html = `<!DOCTYPE html><html><head><title>Finishing connection…</title></head><body style="font-family:system-ui;padding:2rem">
<p>${result.success ? "Connected. You can close this window." : "Failed: " + esc(String((result as { error?: string }).error ?? "Unknown error"))}</p>
<script>
const r = ${safeJson};
if (window.opener && window.opener !== window) window.opener.postMessage({ type: r.success ? "appUserConnectorOAuthComplete" : "appUserConnectorOAuthFailed", connectorId: r.connectorId, code: r.code ?? null }, window.location.origin);
window.close();
</script></body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
