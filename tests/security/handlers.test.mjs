// Isolated server-handler regression tests. Auth, DB and external providers are mocked;
// these are not deployed HTTP, framework middleware, billing or OAuth end-to-end tests.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = process.env.MATRIXKEEP_TEST_SOURCE
  ? pathToFileURL(resolve(process.env.MATRIXKEEP_TEST_SOURCE) + "/").href
  : new URL("../../", import.meta.url).href;
const calls = [];
globalThis.__matrixkeepSecurityMocks = {
  calls,
  stripe: {
    subscriptions: { list: async () => ({ data: [] }) },
    prices: { list: async () => ({ data: [{ id: "price_test", type: "recurring" }] }) },
    customers: { search: async () => ({ data: [{ id: "cus_test" }] }) },
    checkout: {
      sessions: {
        create: async (value) => {
          calls.push(["checkout", value]);
          return { client_secret: "test_secret" };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (value) => {
          calls.push(["portal", value]);
          return { url: "https://billing.stripe.test/session" };
        },
      },
    },
  },
};
const mocks = {
  "./feature-access.server": "export const requireFeature=async()=>{};",
  "./stripe-billing.server":
    'export const existingCustomer=async()=>"cus_test"; export const customerForUser=async()=>"cus_test"; export const validatedPrice=async()=>({id:"price_test"});',

  "@tanstack/react-start":
    "export const createServerFn=()=>{const b={middleware:()=>b,inputValidator:()=>b,handler:fn=>fn};return b};",
  "@tanstack/react-start/server":
    'export const getRequest=()=>new Request("http://localhost/",{headers:{"x-forwarded-host":"attacker.example"}});',
  "@/integrations/supabase/auth-middleware": "export const requireSupabaseAuth={};",
  "@/lib/stripe.server":
    'export function createStripeClient(){globalThis.__matrixkeepSecurityMocks.calls.push(["stripe-client"]);return globalThis.__matrixkeepSecurityMocks.stripe} export const getStripeErrorMessage=e=>e.message;',
  "@/server/appUserConnections.server": "export const getConnectionKeyForUser=async()=>null;",
  "@/integrations/lovable/appUserConnector":
    'export const authorizeAppUserOAuth=async value=>{globalThis.__matrixkeepSecurityMocks.calls.push(["oauth",value]);return {authorizationUrl:"https://accounts.google.test/authorize"}};',
  "./operation.server": "export const reserveOperation=async()=>{};",
  "./ai-usage.server": "export const logAiUsage=async()=>{};",
  zod: 'const chain=new Proxy(function(){return chain},{get:(_,key)=>key==="parse"?value=>value:chain,apply:()=>chain});export const z=chain;',
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(mocks, specifier))
      return {
        url: "data:text/javascript," + encodeURIComponent(mocks[specifier]),
        shortCircuit: true,
      };
    if (specifier.startsWith("./") && context.parentURL?.startsWith("file:")) {
      const url = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { createCheckoutSession, createPortalSession } = await import(
  new URL("src/lib/payments.functions.ts", root)
);
const { startGoogleConnect } = await import(new URL("src/lib/google.functions.ts", root));
const { runExtraction } = await import(new URL("src/lib/capture.server.ts", root));
const query = {
  async single() {
    return { data: { suspended: false } };
  },
  select() {
    return this;
  },
  eq() {
    return this;
  },
  order() {
    return this;
  },
  limit() {
    return this;
  },
  async maybeSingle() {
    return { data: { stripe_customer_id: "cus_test" } };
  },
};
const context = {
  userId: "user_test",
  supabase: {
    auth: { getUser: async () => ({ data: { user: { email: "test@example.invalid" } } }) },
    from: () => query,
  },
};
beforeEach(() => {
  calls.length = 0;
  process.env.APP_ORIGIN = "https://matrixkeep.com";
  delete process.env.APP_ADDITIONAL_RETURN_ORIGINS;
  process.env.NODE_ENV = "production";
  process.env.OPENAI_API_KEY = "test_only";
  process.env.GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY = "test_only";
  globalThis.fetch = async () => {
    calls.push(["fetch"]);
    return new Response("", { status: 429 });
  };
});

test("checkout rejects a foreign return URL before creating a Stripe client", async () => {
  const result = await createCheckoutSession({
    data: { priceId: "home_plus", returnUrl: "https://attacker.example", environment: "sandbox" },
    context,
  });
  assert.match(result.error ?? "", /origin is not allowed/);
  assert.deepEqual(calls, []);
});
test("valid checkout retains its exact allowed return URL", async () => {
  const result = await createCheckoutSession({
    data: {
      priceId: "home_plus",
      returnUrl: "https://matrixkeep.com/app/plans",
      environment: "sandbox",
    },
    context,
  });
  assert.equal(result.clientSecret, "test_secret");
  assert.equal(
    calls.find((c) => c[0] === "checkout")[1].return_url,
    "https://matrixkeep.com/app/plans",
  );
});
test("portal rejects a foreign return before external side effects", async () => {
  await assert.rejects(
    () =>
      createPortalSession({
        data: { returnUrl: "https://attacker.example", environment: "sandbox" },
        context,
      }),
    /origin is not allowed/,
  );
  assert.deepEqual(calls, []);
});
test("portal always receives a configured fallback return", async () => {
  await createPortalSession({ data: { environment: "sandbox" }, context });
  assert.equal(
    calls.find((c) => c[0] === "portal")[1].return_url,
    "https://matrixkeep.com/app/billing",
  );
});
test("forged forwarded-host cannot determine the Google callback", async () => {
  await startGoogleConnect({ data: { connector: "google_mail" }, context });
  assert.equal(
    calls.find((c) => c[0] === "oauth")[1].returnUrl,
    "https://matrixkeep.com/api/oauth/google/return",
  );
});
test("OAuth fails closed without server origin configuration", async () => {
  delete process.env.APP_ORIGIN;
  await assert.rejects(
    () => startGoogleConnect({ data: { connector: "google_mail" }, context }),
    /APP_ORIGIN/,
  );
  assert.deepEqual(calls, []);
});
test("direct extraction rejects remote URLs before any AI provider call", async () => {
  const result = await runExtraction(
    { mode: "photo", text: "", image: "http://169.254.169.254/latest/meta-data" },
    "user_test",
  );
  assert.match(result.error, /Remote image URLs are not accepted/);
  assert.deepEqual(calls, []);
});
test("text-only extraction still reaches the existing provider error path", async () => {
  const result = await runExtraction({ mode: "text", text: "A chair" }, "user_test");
  assert.match(result.error, /AI is busy/);
  assert.deepEqual(calls, [["fetch"]]);
});
