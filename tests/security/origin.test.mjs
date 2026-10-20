import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAppOrigin,
  trustedReturnUrl,
  googleOAuthReturnUrl,
} from "../../src/lib/app-origin.server.ts";

const env = { NODE_ENV: "production", APP_ORIGIN: "https://matrixkeep.com" };
test("payment returns retain allowed paths, query strings and fragments", () => {
  const url = "https://matrixkeep.com/app/plans?session_id={CHECKOUT_SESSION_ID}#billing";
  assert.equal(trustedReturnUrl(url, "/app/plans", env), url);
});
test("portal fallback is always the configured application", () => {
  assert.equal(
    trustedReturnUrl(undefined, "/app/billing", env),
    "https://matrixkeep.com/app/billing",
  );
});
test("staging is isolated from production and other Railway deployments", () => {
  const staging = { ...env, APP_ORIGIN: "https://matrixkeep-staging.up.railway.app" };
  assert.equal(
    trustedReturnUrl(staging.APP_ORIGIN + "/app", "/app", staging),
    staging.APP_ORIGIN + "/app",
  );
  assert.throws(() => trustedReturnUrl("https://matrixkeep.com/app", "/app", staging));
  assert.throws(() => trustedReturnUrl("https://other.up.railway.app/app", "/app", staging));
});
for (const value of [
  "https://attacker.example/app",
  "https://matrixkeep.com.attacker.example/app",
  "https://attacker.example/?next=https://matrixkeep.com",
  "https://matrixkeep.com@attacker.example/app",
  "https://attacker:password@matrixkeep.com/app",
  "https://matrixkeep.com:444/app",
  "http://matrixkeep.com/app",
  "javascript:alert(1)",
  "data:text/html,attack",
  "//matrixkeep.com/app",
  "/app",
  "",
  " https://matrixkeep.com/app",
  "https://matrixkeep.com\\@attacker.example/app",
  "https://matrixkeep.com\n.attacker.example",
  "https://www.matrixkeep.com/app",
  "https://matrixkeep.com./app",
  null,
  17,
])
  test(`reject unsafe return ${JSON.stringify(value)}`, () =>
    assert.throws(() => trustedReturnUrl(value, "/app", env)));

test("www requires an explicit exact configuration", () => {
  const configured = { ...env, APP_ADDITIONAL_RETURN_ORIGINS: "https://www.matrixkeep.com" };
  assert.equal(
    trustedReturnUrl("https://www.matrixkeep.com/app", "/app", configured),
    "https://www.matrixkeep.com/app",
  );
  assert.throws(() =>
    trustedReturnUrl("https://www.matrixkeep.com.attacker.example/app", "/app", configured),
  );
});
test("OAuth callback is derived solely from server configuration", () => {
  assert.equal(googleOAuthReturnUrl(env), "https://matrixkeep.com/api/oauth/google/return");
  assert.equal(
    googleOAuthReturnUrl({ ...env, APP_ORIGIN: "https://staging.example" }),
    "https://staging.example/api/oauth/google/return",
  );
});
test("missing or unsafe origin configuration fails closed", () => {
  for (const origin of [
    undefined,
    "",
    "http://matrixkeep.com",
    "https://matrixkeep.com/app",
    "https://matrixkeep.com?next=x",
    "https://matrixkeep.com#x",
    "https://user:pass@matrixkeep.com",
    "*",
    "https://*.up.railway.app",
    "https://matrixkeep.com\\evil",
  ]) {
    assert.throws(
      () => getAppOrigin({ NODE_ENV: "production", APP_ORIGIN: origin }),
      String(origin),
    );
  }
});
test("HTTP localhost is accepted only in explicit development/test mode", () => {
  assert.equal(
    getAppOrigin({ NODE_ENV: "development", APP_ORIGIN: "http://localhost:5173" }),
    "http://localhost:5173",
  );
  assert.throws(() =>
    getAppOrigin({ NODE_ENV: "production", APP_ORIGIN: "http://localhost:5173" }),
  );
  assert.throws(() => getAppOrigin({ APP_ORIGIN: "http://localhost:5173" }));
});
