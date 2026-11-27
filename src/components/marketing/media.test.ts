import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { photos, scenes } from "./media";

const root = process.cwd();
const urls = [...Object.values(photos), ...Object.values(scenes)];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("portable public marketing media", () => {
  it("uses 49 unique local public files instead of managed asset URLs", () => {
    expect(urls).toHaveLength(49);
    expect(new Set(urls).size).toBe(49);
    for (const url of urls) {
      expect(url).toMatch(/^\/images\/marketing\//);
      expect(url).not.toContain("/__l5e/");
      expect(url).not.toContain(".asset.json");
    }
  });

  it("references exactly the 49 original binaries stored in public", () => {
    const stored = filesUnder(resolve(root, "public/images/marketing"));
    expect(stored).toHaveLength(49);
    for (const url of urls) {
      const path = resolve(root, "public", url.slice(1));
      expect(statSync(path).isFile()).toBe(true);
      const bytes = readFileSync(path);
      if (url.endsWith(".webp")) {
        expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      } else {
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      }
    }
  });
});
