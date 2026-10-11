// Browser-side text extraction for formats the AI can't read directly (Office, text, HTML).
import { unzipSync, strFromU8 } from "fflate";

export const DOC_ACCEPT = "image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.html,.htm,.tif,.tiff";
const stripXml = (x: string) => x.replace(/<\/(w:p|a:p|row)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();

/** Returns readable text for non-image/non-PDF files, null when the AI should read the file itself. */
export async function extractFileText(f: File): Promise<string | null> {
  const name = f.name.toLowerCase();
  if (f.type.startsWith("image/") && !/\.tiff?$/.test(name)) return null;
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
    return parts.map((p, i) => (name.endsWith(".pptx") ? `Slide ${i + 1}:\n` : "") + stripXml(strFromU8(z[p]))).join("\n\n").slice(0, 60000);
  }
  throw new Error("unsupported");
}
