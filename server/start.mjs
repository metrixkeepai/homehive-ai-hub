import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { attachVoice } from "./voice.mjs";
import { validateEnvironment } from "./environment.mjs";
import { ensureSuperAdmin } from "./ensure-super-admin.mjs";
import { publicConfig } from "./public-config.mjs";
validateEnvironment(process.env);
const browserScript = `window.__MATRIXKEEP_PUBLIC__=Object.freeze(${JSON.stringify(publicConfig(process.env))});`;
await ensureSuperAdmin(process.env);
const { middleware } = await import("../.output/server/index.mjs");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(3000) }) },
});
const supabaseOrigin = new URL(process.env.SUPABASE_URL).origin;
const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${supabaseOrigin}; font-src 'self' data:; connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https:", "wss:")} https://api.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`;
let readyUntil = 0,
  ready = false;
const server = createServer(async (request, response) => {
  const id = randomUUID();
  const started = Date.now();
  response.setHeader("X-Request-ID", id);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  response.setHeader("Content-Security-Policy", csp);
  // Set only after the operator has verified HTTPS on the deployment domain.
  if (process.env.HTTPS_VERIFIED === "true")
    response.setHeader("Strict-Transport-Security", "max-age=31536000");
  response.on("finish", () =>
    console.info(
      JSON.stringify({
        event: "http_request",
        request_id: id,
        method: request.method,
        status: response.statusCode,
        latency_ms: Date.now() - started,
      }),
    ),
  );
  const path = new URL(request.url, "http://internal").pathname;
  if (process.env.APP_ENV === "production" && request.headers.host === "www.matrixkeep.com") {
    response.writeHead(308, { Location: process.env.APP_ORIGIN + request.url });
    response.end();
    return;
  }
  if (path === "/matrixkeep-config.js") {
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(browserScript);
    return;
  }
  if (path === "/health/live" || path === "/health/ready") {
    if (path === "/health/ready" && Date.now() > readyUntil) {
      try {
        const result = await db.rpc("production_readiness");
        ready = result.data === true && !result.error;
      } catch {
        ready = false;
      }
      readyUntil = Date.now() + 5000;
    }
    response.statusCode = path === "/health/live" || ready ? 200 : 503;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ status: response.statusCode === 200 ? "ok" : "unavailable" }));
    return;
  }
  if (Number(request.headers["content-length"] ?? 0) > 16_000_000) {
    response.statusCode = 413;
    response.end("Request too large");
    return;
  }
  try {
    await middleware(request, response);
  } catch {
    console.error(JSON.stringify({ event: "http_unhandled_error", request_id: id }));
    if (!response.headersSent) response.statusCode = 500;
    response.end("Request failed");
  }
});
server.requestTimeout = 60_000;
server.headersTimeout = 15_000;
const voice = attachVoice(server);
const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () =>
  console.info(JSON.stringify({ event: "server_started", port })),
);
process.on("SIGTERM", () => {
  voice.clients.forEach((client) => client.close());
  server.close();
  setTimeout(() => process.exit(0), 10000).unref();
});
