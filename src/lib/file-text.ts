// Browser-side text extraction for formats the AI can't read directly (Office, text, HTML).
import { unzipSync, strFromU8 } from "fflate";

export const DOC_ACCEPT = "image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.html,.htm,.tif,.tiff";
const stripXml = (x: string) => x.replace(/<\/(w:p|a:p|row)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();

/** Returns readable text for non-image/non-PDF files, null when the AI should read the file itself. */
export async function extractFileText(f: File): Promise<string | null> {
  const name = f.name.toLowerCase();
  if (f.type.startsWith("image/")) return null;
  if (f.type === "application/pdf" || name.endsWith(".pdf")) return null;
  if (/\.(txt|csv)$/.test(name)) return (await f.text()).slice(0, 60000);
  if (/\.html?$/.test(name)) { const d = new DOMParser().parseFromString(await f.text(), "text/html"); d.querySelectorAll("script,style").forEach((n) => n.remove()); return (d.body?.innerText || d.body?.textContent || "").slice(0, 60000); }
  if (/\.(docx|pptx|xlsx)$/.test(name)) {
    const z = unzipSync(new Uint8Array(await f.arrayBuffer()));
    const pick = (re: RegExp) => Object.keys(z).filter((k) => re.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let parts: string[] = [];
    if (name.endsWith(".docx")) parts = pick(/^word\/(document|header\d*|footer\d*)\.xml$/);
    else if (name.endsWith(".pptx")) parts = pick(/^ppt\/slides\/slide\d+\.xml$/);
    else parts = [...pick(/^xl\/sharedStrings\.xml$/), ...pick(/^xl\/worksheets\/sheet\d+\.xml$/)];
    return parts.map((p, i) => (name.endsWith(".pptx") ? `Slide ${i + 1}:\n` : "") + stripXml(strFromU8(z[p]!))).join("\n\n").slice(0, 60000);
  }
  if (/\.(doc|xls|ppt)$/.test(name)) return legacyText(new Uint8Array(await f.arrayBuffer()));
  throw new Error("unsupported");
}

/** Old binary Office files keep their text as UTF-16 or plain byte runs; pull out readable runs. */
export function legacyText(b: Uint8Array): string {
  const runs: string[] = [];
  const keep = (t: string) => { const c = t.replace(/\s+/g, " ").trim(); if (c.length >= 4 && /[a-z]{2}/i.test(c)) runs.push(c); };
  let cur = "";
  for (let i = 0; i + 1 < b.length; i += 2) { const c = b[i]! | (b[i + 1]! << 8); if ((c >= 32 && c < 0xd800) || c === 9 || c === 10 || c === 13) cur += String.fromCharCode(c); else { keep(cur); cur = ""; } }
  keep(cur); cur = "";
  for (let i = 0; i < b.length; i++) { const c = b[i]!; if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13) cur += String.fromCharCode(c); else { keep(cur); cur = ""; } }
  keep(cur);
  const seen = new Set<string>();
  return runs.filter((r) => !seen.has(r) && seen.add(r) && !/[\u0100-\uffff]{3}/.test(r)).join("\n").slice(0, 60000);
}

/** Browsers can't show TIFF, so convert the first page to PNG for preview and AI reading. */
export async function tiffToPng(f: File): Promise<File> {
  const UTIF = (await import("utif")).default as { decode: (b: ArrayBuffer) => { width: number; height: number }[]; decodeImage: (b: ArrayBuffer, ifd: unknown) => void; toRGBA8: (ifd: unknown) => Uint8Array };
  const buf = await f.arrayBuffer();
  const ifds = UTIF.decode(buf); const ifd = ifds[0];
  if (!ifd) throw new Error("bad tiff");
  UTIF.decodeImage(buf, ifd);
  const rgba = UTIF.toRGBA8(ifd);
  const c = document.createElement("canvas"); c.width = ifd.width; c.height = ifd.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height), 0, 0);
  const blob = await new Promise<Blob>((ok, no) => c.toBlob((x) => (x ? ok(x) : no(new Error("png"))), "image/png"));
  return new File([blob], f.name.replace(/\.tiff?$/i, ".png"), { type: "image/png" });
}

/** Fingerprint used to spot the same file uploaded twice. */
export async function fileHash(f: File) {
  const d = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
