import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { verifyWebhook, createStripeClient } from "../../src/lib/stripe.server.ts";
const secret = "whsec_local_test_fixture_only";
const sdk = new Stripe("sk_test_local_fixture_only");
const payload = (livemode = false) =>
  JSON.stringify({
    id: "evt_local_fixture",
    object: "event",
    type: "invoice.paid",
    created: Math.floor(Date.now() / 1000),
    livemode,
    data: { object: { id: "in_fixture", object: "invoice" } },
  });
function request(
  body,
  { signedBody = body, timestamp = Math.floor(Date.now() / 1000), signingSecret = secret } = {},
) {
  const signature = sdk.webhooks.generateTestHeaderString({
    payload: signedBody,
    secret: signingSecret,
    timestamp,
  });
  return new Request("https://staging.example.test/api/public/payments/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}
beforeEach(() => {
  process.env.STRIPE_ENVIRONMENT = "sandbox";
  process.env.STRIPE_SECRET_KEY = "sk_test_local_fixture_only";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
});
test("official Stripe verification accepts the original signed payload", async () => {
  assert.equal((await verifyWebhook(request(payload()), "sandbox")).id, "evt_local_fixture");
});
test("Stripe verification rejects tampering, missing signatures and incorrect secrets", async () => {
  await assert.rejects(
    verifyWebhook(request(payload() + " ", { signedBody: payload() }), "sandbox"),
  );
  await assert.rejects(verifyWebhook(request(payload(), { signingSecret: "wrong" }), "sandbox"));
  await assert.rejects(
    verifyWebhook(
      new Request("https://staging.example.test", { method: "POST", body: payload() }),
      "sandbox",
    ),
  );
});
test("Stripe verification rejects replayed timestamps and cross-environment events", async () => {
  await assert.rejects(
    verifyWebhook(
      request(payload(), { timestamp: Math.floor(Date.now() / 1000) - 600 }),
      "sandbox",
    ),
  );
  await assert.rejects(verifyWebhook(request(payload(true)), "sandbox"), /environment mismatch/);
  assert.throws(() => createStripeClient("live"), /environment is not allowed/);
});
