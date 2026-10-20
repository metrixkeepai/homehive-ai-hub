import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCaptureMedia } from "../../src/lib/capture-media.server.ts";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=",
  "base64",
);
const dataUrl = (mime, bytes) => `data:${mime};base64,${bytes.toString("base64")}`;
const png = dataUrl("image/png", tinyPng);
test("real JPEG and WebP image fixtures are accepted", () => {
  const fixtures = JSON.parse(
    readFileSync(new URL("./media-fixtures.json", import.meta.url), "utf8"),
  );
  for (const [format, encoded] of Object.entries(fixtures)) {
    validateCaptureMedia({ image: `data:image/${format};base64,${encoded}` });
  }
});
test("text-only extraction needs no media", () => validateCaptureMedia({}));
test("PNG uploads and sampled video frames remain supported", () => {
  validateCaptureMedia({ image: png });
  validateCaptureMedia({ images: Array(8).fill(png) });
});
test("bounded PDFs are supported only in the document slot", () => {
  const pdf = dataUrl("application/pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"));
  validateCaptureMedia({ image: pdf });
  assert.throws(() => validateCaptureMedia({ images: [pdf] }));
});
for (const url of [
  "http://127.0.0.1/admin",
  "http://localhost",
  "http://[::1]",
  "http://2130706433",
  "http://169.254.169.254/latest/meta-data",
  "http://10.0.0.1",
  "http://172.16.0.1",
  "http://192.168.1.1",
  "https://public.example/redirect-to-private",
  "file:///etc/passwd",
  "https://storage.example/object/sign/evidence/x?token=x",
  "ftp://example/file",
  "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  "data:text/html;base64,PHNjcmlwdD4=",
  "data:image/png,not-base64",
  "data:image/png;base64,@@@@",
  "data:image/png;base64,AB==",
  "data:image/png;base64,",
  "",
])
  test(`reject capture input ${url.slice(0, 75)}`, () => {
    assert.throws(() => validateCaptureMedia({ image: url }));
    assert.throws(() => validateCaptureMedia({ images: [url] }));
  });
test("MIME labels must match magic bytes", () => {
  assert.throws(() => validateCaptureMedia({ image: dataUrl("image/jpeg", tinyPng) }));
  assert.throws(() => validateCaptureMedia({ image: dataUrl("application/pdf", tinyPng) }));
  assert.throws(() => validateCaptureMedia({ image: dataUrl("image/png", Buffer.from("<html>")) }));
});
test("oversized, malformed and zero image dimensions are rejected", () => {
  for (const [width, height] of [
    [0, 1],
    [1, 0],
    [20_000, 1],
    [6000, 6000],
  ]) {
    const large = Buffer.from(tinyPng);
    large.writeUInt32BE(width, 16);
    large.writeUInt32BE(height, 20);
    assert.throws(() => validateCaptureMedia({ image: dataUrl("image/png", large) }));
  }
  assert.throws(() =>
    validateCaptureMedia({ image: dataUrl("image/png", tinyPng.subarray(0, 20)) }),
  );
});
test("aggregate pixel budget applies across video frames", () => {
  const frame = Buffer.from(tinyPng);
  frame.writeUInt32BE(4000, 16);
  frame.writeUInt32BE(4000, 20);
  assert.throws(() => validateCaptureMedia({ images: Array(4).fill(dataUrl("image/png", frame)) }));
});
test("byte, frame count and aggregate size caps are enforced", () => {
  assert.throws(() =>
    validateCaptureMedia({ image: dataUrl("image/png", Buffer.alloc(5 * 1024 * 1024 + 1)) }),
  );
  assert.throws(() => validateCaptureMedia({ images: Array(9).fill(png) }));
  const large = Buffer.alloc(1_000_000);
  tinyPng.copy(large);
  const primary = Buffer.alloc(3_000_000);
  tinyPng.copy(primary);
  assert.throws(() =>
    validateCaptureMedia({
      image: dataUrl("image/png", primary),
      images: Array(8).fill(dataUrl("image/png", large)),
    }),
  );
});
test("truncated JPEG/WebP and malformed frame collections fail safely", () => {
  assert.throws(() =>
    validateCaptureMedia({ image: dataUrl("image/jpeg", Buffer.from("ffd8ffe00001", "hex")) }),
  );
  assert.throws(() =>
    validateCaptureMedia({ image: dataUrl("image/webp", Buffer.from("RIFFWEBP")) }),
  );
  assert.throws(() => validateCaptureMedia({ images: "not-an-array" }));
});
