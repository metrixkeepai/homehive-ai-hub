import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { attachVoice } from "../../server/voice.mjs";
import { validateEnvironment, verifyLiveStripeAccount } from "../../server/environment.mjs";

test("voice rejects unauthenticated and cross-origin upgrades before contacting a provider", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const voice = attachVoice(server, { APP_ORIGIN: origin });
  try {
    for (const [requestOrigin, expected] of [
      [origin, 401],
      ["https://attacker.example", 403],
    ]) {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`${origin.replace("http", "ws")}/api/live`, ["matrixkeep"], {
          origin: requestOrigin,
        });
        ws.on("unexpected-response", (_req, response) => {
          try {
            assert.equal(response.statusCode, expected);
            response.resume();
            ws.terminate();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        ws.on("error", () => {});
        ws.on("open", () => reject(new Error("Unauthorised upgrade accepted")));
      });
    }
  } finally {
    voice.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("startup requires complete configuration and refuses mixed payment environments", () => {
  assert.throws(() => validateEnvironment({}), /Missing configuration/);
  const env = {
    APP_ENV: "staging",
    APP_ORIGIN: "https://staging.example.test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-test-placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "private-test-placeholder",
    OPENAI_API_KEY: "test-placeholder",
    STRIPE_ENVIRONMENT: "sandbox",
    VITE_PAYMENTS_CLIENT_TOKEN: "pk_test_placeholder",
    STRIPE_SECRET_KEY: "rk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
  };
  assert.doesNotThrow(() => validateEnvironment(env));
  assert.throws(
    () => validateEnvironment({ ...env, VITE_PAYMENTS_CLIENT_TOKEN: "" }),
    /Missing configuration: VITE_PAYMENTS_CLIENT_TOKEN/,
  );
  assert.throws(
    () => validateEnvironment({ ...env, STRIPE_ENVIRONMENT: "live" }),
    /Staging requires sandbox/,
  );
  assert.throws(
    () => validateEnvironment({ ...env, STRIPE_SECRET_KEY: "rk_live_placeholder" }),
    /mode mismatch/,
  );
  assert.throws(
    () => validateEnvironment({ ...env, VITE_OPENAI_API_KEY: "test-placeholder" }),
    /Unsafe public variable/,
  );
});

test("the public runtime script accepts only browser credentials for the same environment", async () => {
  const { publicConfig } = await import("../../server/public-config.mjs");
  const env = {
    SUPABASE_URL: "https://example.test",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
    APP_ORIGIN: "https://example.test",
    OPENAI_API_KEY: "server-only-canary",
    STRIPE_ENVIRONMENT: "sandbox",
    VITE_PAYMENTS_CLIENT_TOKEN: "pk_test_placeholder",
  };
  assert.deepEqual(Object.keys(publicConfig(env)).sort(), [
    "VITE_APP_ORIGIN",
    "VITE_PAYMENTS_CLIENT_TOKEN",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
  ]);
  assert.throws(() => publicConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: "sb_secret_placeholder" }));
  assert.throws(() => publicConfig({ ...env, VITE_SUPABASE_URL: "https://other.example" }));
  assert.throws(() => publicConfig({ ...env, VITE_PAYMENTS_CLIENT_TOKEN: "pk_live_placeholder" }));
});

test("only a key for the pinned dedicated production merchant can start live billing", async () => {
  const env = { APP_ENV: "production", STRIPE_ENVIRONMENT: "live",
    STRIPE_ACCOUNT_ID: "acct_Expected", STRIPE_SECRET_KEY: "sk_live_fixture" };
  let requests = 0;
  const request = async (url, options) => {
    requests++;
    assert.equal(url, "https://api.stripe.com/v1/account");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer sk_live_fixture");
    return Response.json({ id: "acct_Expected" });
  };
  await verifyLiveStripeAccount({ APP_ENV: "staging", STRIPE_ENVIRONMENT: "sandbox" }, request);
  await verifyLiveStripeAccount({ APP_ENV: "production", STRIPE_ENVIRONMENT: "disabled" }, request);
  await assert.rejects(verifyLiveStripeAccount({ ...env, STRIPE_ACCOUNT_ID: "" }, request), /STRIPE_ACCOUNT_ID/);
  assert.equal(requests, 0);
  await verifyLiveStripeAccount(env, request);
  await assert.rejects(verifyLiveStripeAccount({ ...env, STRIPE_ACCOUNT_ID: "acct_Other" }, request), /verification failed/);
  await assert.rejects(verifyLiveStripeAccount(env, async () => new Response(null, { status: 401 })), /verification failed/);
});
