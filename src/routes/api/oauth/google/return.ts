import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/oauth/google/return")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `<!doctype html><title>Google consent</title><p>Finishing your MatrixKeep connection…</p><script>const p=new URLSearchParams(location.search);window.opener?.postMessage({type:p.get('code')?'appUserConnectorOAuthComplete':'appUserConnectorOAuthFailed',state:p.get('state'),code:p.get('code')},location.origin);window.close()</script>`,
          {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
              "referrer-policy": "no-referrer",
            },
          },
        ),
    },
  },
});
