import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = promisify(execFile);

// Text substitution is restricted to plain prose with no painted graphics. Any uncertainty
// (including columns, non-textual pages or layout-sensitive amounts) retains the original PDF.
export async function prosePdfText(dataUrl: string): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), "mk-pdf-"));
  const path = join(dir, "document.pdf");
  const opts = {
    timeout: 4500,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8" as const,
    killSignal: "SIGKILL" as const,
  };
  try {
    await writeFile(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"), {
      mode: 0o600,
    });
    const { stdout: info } = await run("pdfinfo", [path], opts);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!pages || pages > 40 || !/^Encrypted:\s+no/m.test(info) || !/^Form:\s+none/m.test(info))
      return null;
    const { stdout: trace } = await run("mutool", ["draw", "-F", "trace", "-o", "-", path], opts);
    if (
      !/<fill_text\b/.test(trace) ||
      /<(?:fill_path|stroke_path|fill_image|fill_shade|stroke_text|clip_text|begin_mask|begin_tile)\b/.test(
        trace,
      )
    )
      return null;
    const { stdout: text } = await run("pdftotext", ["-layout", "-enc", "UTF-8", path, "-"], opts);
    const sections = text.trimEnd().split("\f");
    if (
      sections.length !== pages ||
      text.length > 60000 ||
      /\uFFFD|\S {4,}\S/.test(text) ||
      sections.some((p) => p.trim().length < 100)
    )
      return null;
    return sections.map((page, i) => `Page ${i + 1}\n${page.trim()}`).join("\n\n");
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
