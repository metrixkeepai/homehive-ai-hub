import assert from "node:assert/strict";
import test from "node:test";
import { createReadinessClient } from "../../server/readiness-client.mjs";

for (const [label, key, authorization] of [
  ["opaque server key", "sb_secret_test_only", null],
  ["legacy JWT", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test", "bearer"],
]) {
  test(`readiness RPC uses the correct headers for a ${label}`, async () => {
    let sent = false;
    const db = createReadinessClient("https://example.invalid", key, async (url, init) => {
      assert.equal(new URL(url).pathname, "/rest/v1/rpc/production_readiness");
      assert.equal(init.headers.get("apikey"), key);
      assert.equal(init.headers.get("authorization"), authorization && `Bearer ${key}`);
      assert.ok(init.signal instanceof AbortSignal);
      sent = true;
      return Response.json(true);
    });
    const { data, error } = await db.rpc("production_readiness");
    assert.equal(error, null);
    assert.equal(data, true);
    assert.ok(sent);
  });
}
