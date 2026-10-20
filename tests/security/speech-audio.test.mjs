import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeSpeechWav, speechWavDuration } from "../../src/lib/speech-audio.ts";
test("recording duration is derived from validated PCM bytes", () => {
  const bytes = encodeSpeechWav(new Float32Array(48000), 48000);
  assert.equal(speechWavDuration(bytes), 1);
  const altered = bytes.slice();
  new DataView(altered.buffer).setUint32(24, 1, true);
  assert.throws(() => speechWavDuration(altered), /Invalid recording format/);
  assert.throws(
    () => speechWavDuration(bytes.subarray(0, bytes.length - 2)),
    /Invalid recording format/,
  );
  assert.throws(() => speechWavDuration(new Uint8Array(3840046)), /Invalid recording length/);
  assert.throws(() => encodeSpeechWav(new Float32Array(16000 * 121), 16000), /two minutes/);
});
