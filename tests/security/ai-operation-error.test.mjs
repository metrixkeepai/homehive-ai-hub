import assert from "node:assert/strict";
import test from "node:test";
import { OperationFailure } from "../../src/lib/ai-operation-error.ts";
test("customer diagnostics distinguish entitlement, monthly allowance, budget and rate limiting", () => {
  const reasons = [
    "Plan feature unavailable",
    "Monthly quota reached",
    "Platform AI budget reached",
    "Rate limit reached",
  ];
  assert.equal(
    new Set(reasons.map((reason) => new OperationFailure(reason, "reserve").message)).size,
    4,
  );
  assert.doesNotMatch(new OperationFailure("private upstream detail", "claim").message, /private/);
});
