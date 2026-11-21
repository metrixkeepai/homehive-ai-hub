import { randomUUID } from "node:crypto";

export function createExecutionIdentity(run, attempt) {
  const nonce = randomUUID();
  return {
    executionId: [run, attempt, nonce].join("-"),
    email: "metrixkeepai+qa-" + nonce + "@gmail.com",
  };
}
