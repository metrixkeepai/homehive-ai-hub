import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/internal/connector-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env["APP_ENV"] !== "staging") return new Response(null, { status: 404 });
        const header = request.headers.get("authorization") ?? "";
        if (!/^Bearer [a-f0-9-]{72}$/.test(header)) return new Response(null, { status: 401 });
        const { db } = await import("@/lib/connector-review.server");
        const r = await db.rpc("consume_connector_tick", { _token: header.slice(7) });
        if (r.error || r.data !== true) return new Response(null, { status: 403 });
        await (await import("@/lib/start-connector-worker.server")).startWorker();
        return new Response(null, { status: 202 });
      },
    },
  },
});
