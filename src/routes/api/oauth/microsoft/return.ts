import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/oauth/microsoft/return")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `<!doctype html><title>Microsoft consent</title><p>Finishing your MatrixKeep connection…</p><script>const p=new URLSearchParams(location.search);window.opener?.postMessage({type:'matrixkeep-microsoft-consent',state:p.get('state'),code:p.get('code')},location.origin);window.close()</script>`,
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
