import { Buffer } from "node:buffer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FRAME_BYTES = 1_100_000;
const MAX_PIXELS = 25_000_000;
const MAX_TOTAL_PIXELS = 50_000_000;
const MAX_DIMENSION = 16_384;
const invalid = () =>
  new Error("Capture requires a valid JPEG, PNG, WebP or PDF upload within the size limits.");

function dimensions(bytes: Buffer, mime: string): [number, number] {
  if (mime === "image/png") {
    if (
      bytes.length < 33 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR"
    )
      throw invalid();
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) throw invalid();
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) throw invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) throw invalid();
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        if (length < 8) throw invalid();
        return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      }
      offset += length;
    }
    throw invalid();
  }
  if (mime === "image/webp") {
    if (
      bytes.length < 26 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WEBP" ||
      bytes.readUInt32LE(4) + 8 !== bytes.length
    )
      throw invalid();
    const chunk = bytes.toString("ascii", 12, 16);
    const length = bytes.readUInt32LE(16);
    if (length > bytes.length - 20) throw invalid();
    if (chunk === "VP8X" && length >= 10) {
      // Animated files are deliberately excluded from single-image capture.
      if (bytes[20]! & 0x02) throw invalid();
      return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    }
    if (chunk === "VP8 " && length >= 10 && bytes.subarray(23, 26).toString("hex") === "9d012a") {
      return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    }
    if (chunk === "VP8L" && length >= 5 && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
  }
  throw invalid();
}

/** Data-only ingestion prevents remote fetches, redirects, metadata access and DNS rebinding. */
export function validateCaptureMedia(data: {
  image?: string | undefined;
  images?: string[] | undefined;
}): void {
  if (data.images !== undefined && (!Array.isArray(data.images) || data.images.length > 8))
    throw invalid();
  const inputs = [
    ...(data.image === undefined ? [] : [{ value: data.image, frame: false }]),
    ...(data.images ?? []).map((value) => ({ value, frame: true })),
  ];
  let totalBytes = 0,
    totalPixels = 0;
  for (const { value, frame } of inputs) {
    const maxBytes = frame ? MAX_FRAME_BYTES : MAX_FILE_BYTES;
    if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 40)
      throw invalid();
    const comma = value.indexOf(",");
    const header = value.slice(0, comma);
    const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64$/.exec(header);
    if (!match || comma < 0 || (frame && match[1] === "application/pdf")) throw invalid();
    const encoded = value.slice(comma + 1);
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
      throw invalid();
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > maxBytes || bytes.toString("base64") !== encoded) throw invalid();
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw invalid();
    const mime = match[1]!;
    if (mime === "application/pdf") {
      if (
        !/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.toString("ascii", 0, 8)) ||
        !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
      )
        throw invalid();
      continue;
    }
    const [width, height] = dimensions(bytes, mime);
    if (
      !width ||
      !height ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      width * height > MAX_PIXELS
    )
      throw invalid();
    totalPixels += width * height;
    if (totalPixels > MAX_TOTAL_PIXELS) throw invalid();
  }
}
