// Cloud Run Job entry point. No HTTP listener, credentials or session URLs in output.
import assert from "node:assert/strict";

const probe = process.env.ACCEPTANCE_RUN;
assert.equal(process.env.APP_ENV, "production");
assert.equal(process.env.STRIPE_ENVIRONMENT, "disabled");
assert.equal(process.env.STRIPE_ACCOUNT_ID, "acct_1Ug5NgE3qBBc51tM");
assert(probe && /^[0-9]+-[0-9]+$/.test(probe));
assert(
  /^rk_live_/.test(process.env.STRIPE_SECRET_KEY || ""),
  "Expected restricted live key",
);
const origin = "https://matrixkeep.com";

async function stripe(method, resource, permission, fields = {}) {
  const params = new URLSearchParams(fields);
  const url = new URL("/v1/" + resource, "https://api.stripe.com");
  const headers = {
    Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY,
    "Stripe-Version": "2026-08-26.dahlia",
  };
  if (method === "GET") url.search = params.toString();
  else
    headers["Idempotency-Key"] =
      "matrixkeep-accept-" + probe + "-" + resource.replaceAll("/", "-");
  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? params : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const code = (await response.json().catch(() => ({}))).error?.code;
    throw new Error(
      method +
        " /v1/" +
        resource +
        " HTTP " +
        response.status +
        (response.status === 403 ? " required permission: " + permission : "") +
        (typeof code === "string" && /^[a-z0-9_]+$/.test(code)
          ? " " + code
          : ""),
    );
  }
  return response.json();
}

const account = await stripe("GET", "account", "Account read");
assert.equal(account.id, process.env.STRIPE_ACCOUNT_ID);
const prices = await stripe("GET", "prices", "Prices and Products read", {
  "lookup_keys[]": "home_monthly",
  active: "true",
  limit: "2",
  "expand[]": "data.product",
});
const [price] = prices.data;
assert(
  prices.data.length === 1 &&
    price.livemode &&
    price.currency === "gbp" &&
    price.unit_amount === 499 &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.product.active &&
    price.product.metadata.app === "matrixkeep" &&
    price.product.metadata.plan === "home",
  "Home monthly price mismatch",
);
const customer = await stripe("POST", "customers", "Customers write", {
  "metadata[matrixkeep_acceptance]": probe,
});
assert(customer.livemode && /^cus_[a-zA-Z0-9]+$/.test(customer.id));
await stripe("GET", "subscriptions", "Subscriptions read", {
  customer: customer.id,
  status: "all",
  limit: "1",
});
await stripe("GET", "checkout/sessions", "Checkout Sessions read", {
  customer: customer.id,
  limit: "1",
});
const session = await stripe(
  "POST",
  "checkout/sessions",
  "Checkout Sessions write",
  {
    customer: customer.id,
    mode: "subscription",
    ui_mode: "embedded_page",
    "adaptive_pricing[enabled]": "false",
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    return_url: origin + "/app/plans",
    "metadata[matrixkeep_acceptance]": probe,
  },
);
assert(/^cs_live_[a-zA-Z0-9]+$/.test(session.id));
try {
  assert(
    session.livemode &&
      session.status === "open" &&
      session.payment_status === "unpaid" &&
      session.customer === customer.id &&
      session.amount_total === 499 &&
      session.currency === "gbp" &&
      Boolean(session.client_secret),
    "Unpaid live Checkout mismatch",
  );
  const portal = await stripe(
    "POST",
    "billing_portal/sessions",
    "Customer portal write",
    {
      customer: customer.id,
      return_url: origin + "/app/plans",
    },
  );
  assert(
    portal.livemode &&
      portal.customer === customer.id &&
      portal.return_url === origin + "/app/plans" &&
      new URL(portal.url).protocol === "https:",
    "Portal response mismatch",
  );
} finally {
  const expired = await stripe(
    "POST",
    "checkout/sessions/" + session.id + "/expire",
    "Checkout Sessions write",
  );
  assert(expired.status === "expired" && expired.payment_status === "unpaid");
}
console.info(
  JSON.stringify({
    event: "billing_acceptance_sessions_passed",
    probe,
    session: session.id,
  }),
);
