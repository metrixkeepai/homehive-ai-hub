import { test } from "node:test";
import assert from "node:assert/strict";
import { sameRoomFrame } from "../../src/lib/room-frames.ts";
test("room frame coalescing keeps local differences and drops imperceptible noise", () => {
  const a = new Uint8ClampedArray(12000).fill(125),
    b = a.slice();
  b[4000] = 127;
  assert.equal(sameRoomFrame(a, b), true);
  b[4001] = 134;
  assert.equal(sameRoomFrame(a, b), false);
  assert.equal(sameRoomFrame(undefined, a), false);
});
