import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, authTemplate } from "./render.mjs";
import { deliverEmail } from "./delivery.mjs";
test("rendering escapes customer input and handles absent first names and optional fields", () => {
  const m = renderEmail("welcome", { first_name: "<Alex>" }, "production");
  assert.match(m.html, /Welcome to MatrixKeep, &lt;Alex&gt;/);
  assert.match(m.text, /Welcome to MatrixKeep, <Alex>/);
  const v = renderEmail("voucher", {}, "staging");
  assert.match(v.text, /Hi there,/);
  assert.doesNotMatch(v.text, /Voucher:|Valid until:/);
  assert.match(v.text, /https:\/\/matrixkeep-staging-web-[^\s]+\/app/);
  assert.throws(() => renderEmail("activated", {}, "production"), /Missing display field/);
  assert.throws(
    () => renderEmail("welcome", { first_name: "cus_12345" }, "production"),
    /internal value/,
  );
});
test("security actions keep their environment, purpose and signed link", () => {
  const url = "https://caqtifaytqukimdkyahv.supabase.co/auth/v1/verify?token=fixture&type=recovery";
  assert.match(
    renderEmail("recovery", { action_url: url }, "production").text,
    /token=fixture&type=recovery/,
  );
  assert.throws(() => renderEmail("invite", { action_url: url }, "production"));
  assert.throws(() => renderEmail("recovery", { action_url: url }, "staging"));
  assert.throws(() =>
    renderEmail("recovery", { action_url: url + "&redirect_to=https://example.com" }, "production"),
  );
  assert.match(authTemplate("confirmation", "production").html, /href="{{ .ConfirmationURL }}"/);
});
test("only scheduled cancellations include the access date", () => {
  const f = { plan_name: "Family", access_end_date: "12 May" };
  assert.doesNotMatch(renderEmail("cancelled", f, "production").text, /12 May/);
  assert.match(
    renderEmail("cancelled", { ...f, end_of_period: true }, "production").text,
    /12 May/,
  );
});
test("duplicate calls, uncertain acceptance and externally-owned billing mail", async () => {
  const seen = new Set();
  let sent = 0;
  const sql = async ([query], key) => {
    if (query.startsWith("INSERT") && !seen.has(key)) {
      seen.add(key);
      return [{ key }];
    }
    return [];
  };
  const event = {
    sql,
    send: async () => {
      sent++;
    },
    kind: "welcome",
    environment: "production",
    occurrence: "account-confirmed",
    to: "alex@example.com",
    fields: {},
  };
  await Promise.all([deliverEmail(event), deliverEmail(event)]);
  assert.equal(sent, 1);
  assert.equal(await deliverEmail({ ...event, kind: "payment_received" }), "externally-managed");
  const uncertain = {
    ...event,
    occurrence: "another",
    send: async () => {
      throw Error("timeout");
    },
  };
  await assert.rejects(deliverEmail(uncertain), /timeout/);
  assert.equal(await deliverEmail(uncertain), "already-claimed");
});
