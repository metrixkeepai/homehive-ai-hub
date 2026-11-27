import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, "WEBSITE_ASSET_MANIFEST.json"), "utf8"));
const registry = readFileSync(resolve(root, "src/components/marketing/media.ts"), "utf8");
const failures = [];

if (manifest.assets.length !== 49)
  failures.push(`Expected 49 assets, found ${manifest.assets.length}`);
if (/\/__l5e\/assets-v1\/|\.asset\.json/.test(registry)) {
  failures.push("The runtime marketing registry still contains a managed asset reference");
}

for (const asset of manifest.assets) {
  const path = resolve(root, asset.actual_local_destination_path);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    failures.push(`Missing ${asset.actual_local_destination_path}`);
    continue;
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== asset.expected_binary_file_size) {
    failures.push(`Original size mismatch: ${asset.actual_local_destination_path}`);
  }
  if (bytes.length !== asset.actual_binary_file_size) {
    failures.push(`Local size mismatch: ${asset.actual_local_destination_path}`);
  }
  if (sha256 !== asset.sha256)
    failures.push(`Checksum mismatch: ${asset.actual_local_destination_path}`);
  if (asset.original_content_type === "image/webp") {
    if (bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WEBP") {
      failures.push(`Invalid WebP signature: ${asset.actual_local_destination_path}`);
    }
  } else if (asset.original_content_type === "image/png") {
    if (bytes.subarray(1, 4).toString() !== "PNG") {
      failures.push(`Invalid PNG signature: ${asset.actual_local_destination_path}`);
    }
  }
  const registryPath = asset.public_url.replace("/images/marketing/", "");
  if (!registry.includes(`"${registryPath}"`)) {
    failures.push(`Not present in runtime registry: ${asset.actual_local_destination_path}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Verified ${manifest.assets.length} original marketing binaries (${manifest.summary.total_binary_asset_size_bytes} bytes).`,
);
console.log("All checksums, file signatures, sizes and local runtime references match.");
