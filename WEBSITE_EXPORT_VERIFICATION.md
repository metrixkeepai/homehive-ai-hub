# MatrixKeep portable marketing asset verification

Verified on 27 November 2026 in the project preview and against the files on disk.

## Retrieval and binary integrity

- `.asset.json` files discovered: **49**.
- Unique underlying marketing assets: **49**.
- Original image binaries retrieved with supported `lovable-assets get`: **49**.
- Original image binaries stored locally: **49** (48 WebP, 1 PNG).
- External video resources retrieved: **0 found**.
- External animation resources retrieved: **0 found**; existing motion is React/CSS-driven.
- Unresolved assets: **0**.
- Runtime Lovable-specific asset references: **0**.
- Original descriptor files retained for provenance: **49**; these are not runtime imports.
- Total binary size: **4,477,264 bytes** (approximately 4.27 MiB).
- Local directory: `public/images/marketing/` with `hero`, `industries`, `individuals`, `business`, `enterprise`, `product`, `use-cases`, `digital-passport` and `sera` subdirectories.

`node scripts/verify-marketing-assets.mjs` passed for every expected/actual byte count, SHA-256 checksum, file signature and runtime registry entry.

`bunx vitest run src/components/marketing/media.test.ts` passed: **1 test file, 2 tests**.

## Public browser verification

A fresh Chromium browser opened and scrolled through **42 public routes**, including the homepage, audience pages, every product/company page, both index pages, all 12 industry details and all 12 use-case details.

Results:

- Unique expected local marketing images rendered: **49 of 49**.
- Broken images: **0**.
- `/__l5e/assets-v1/` requests: **0**.
- External image URLs: **0**.
- Browser page errors: **0**.

The checks exercised homepage hero scenes, Individual, Business and Enterprise pages, industry and use-case imagery, Digital Passport and Sera demonstrations, header/menu images and scroll-story images.

## Interaction verification

- Hero scene switch: passed; `/images/marketing/hero/scene-life.webp` changed to `/images/marketing/hero/scene-business.webp`.
- Mega-menu preview: passed; local `/images/marketing/product/matrixkeep-coffee.webp` rendered.
- Scroll story: passed; forward progress reached `0.900` with the passport visible, then reverse scrolling returned to `0.100` and removed the passport stage.
- Reduced motion: passed; the complete static story rendered at progress `1.000`.

## Build verification limitation

The latest automatic app-wide preview compilation still fails before a clean production build can be certified. The errors are pre-existing incomplete generated backend type definitions affecting protected files including `Billing.tsx`, `PassportModal.tsx`, `RecordEmailReminder.tsx`, `admin-ops.functions.ts`, `ai-cache.server.ts`, `ai-usage.server.ts` and `billing-catalogue.server.ts`.

This asset task did not alter those files, the generated backend definitions, the database or any protected system. Therefore this report certifies the local binaries, their public runtime rendering and the export archives, but **does not claim a clean app-wide production build or independent production-server deployment**.

## Export verification

The source archive is assembled without repository metadata, dependencies, generated build output, environment files or secrets. The standalone asset archive contains the same 49 binary files, the local runtime registry, manifest, mapping, verification script and migration instructions. Archive entry and extracted-checksum results are recorded after packaging in `MatrixKeep-export-checksums.txt` alongside the downloadable archives.

The platform's own **Download Codebase** ZIP was not available for direct inspection in this session. The supplied source and asset ZIPs are the verified alternative; no claim is made about the platform control converting or omitting the new public binaries.
