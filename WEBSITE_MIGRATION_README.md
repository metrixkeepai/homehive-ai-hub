# MatrixKeep public website asset migration

## What is included

The approved public marketing photography is now stored as real binary files under `public/images/marketing/`. The public runtime registry in `src/components/marketing/media.ts` uses ordinary root-relative paths such as `/images/marketing/hero/scene-life.webp`.

- 49 original `.asset.json` descriptors discovered.
- 49 unique underlying assets retrieved with the supported `lovable-assets get` command.
- 49 original binaries stored locally: 48 WebP files and one PNG.
- 4,477,264 bytes of original image data.
- No external marketing video or animation resources were found. The cinematic and scroll-driven experiences use the existing React and CSS code.
- No unresolved marketing assets.
- No runtime `/__l5e/assets-v1/` or `.asset.json` imports in the marketing media registry.

The original descriptors remain under `src/assets/marketing/` for provenance and previous-version compatibility. They are not imported by the public website. `src/components/marketing/imageManifest.ts` also retains descriptor paths as audit metadata, not as runtime image URLs.

## Files

- `WEBSITE_ASSET_MANIFEST.json` — machine-readable inventory, original and local paths, byte sizes, dimensions, SHA-256 checksums, page/section assignments and export status.
- `WEBSITE_ASSET_MAP.csv` — flat descriptor-to-local-file mapping.
- `scripts/verify-marketing-assets.mjs` — offline integrity and runtime-reference verification.
- `src/components/marketing/media.test.ts` — automated 49-file local portability tests.
- `MatrixKeep-portable-source.zip` — source snapshot with the actual binaries included.
- `MatrixKeep-marketing-assets.zip` — standalone binary asset pack, manifest, mapping and these instructions.

## Migrate into an existing application

### Option A: use the portable source archive

1. Extract `MatrixKeep-portable-source.zip`.
2. Copy or merge the required source into the target application, preserving `public/images/marketing/` exactly.
3. Preserve the root-relative `/images/marketing/...` URLs. The target web server must serve the `public` directory at the site root, as Vite does.
4. Install with `bun install --frozen-lockfile` and run the existing project build with `bun run build` in the target environment.
5. Keep the target application's existing environment configuration for account, payment and backend features. No new asset service or asset environment variable is required.

### Option B: add only the asset pack

1. Extract `MatrixKeep-marketing-assets.zip` at the target repository root.
2. Confirm that `public/images/marketing/` contains 49 files in its category subdirectories.
3. Use the included `src/components/marketing/media.ts` registry, or make the equivalent paths in your application point to `/images/marketing/...`.
4. Run `node scripts/verify-marketing-assets.mjs` from the repository root.

No Lovable asset endpoint, CDN credential, R2 credential or special route handler is needed to display these images.

## Verify integrity

From the repository root:

```bash
node scripts/verify-marketing-assets.mjs
bunx vitest run src/components/marketing/media.test.ts
```

The verification checks all 49 files, expected and actual byte counts, SHA-256 checksums, WebP/PNG signatures and local runtime registry references. `WEBSITE_ASSET_MAP.csv` can also be used with any standard SHA-256 tool.

## Visual and interactive compatibility

Only media location changed. Image bytes, page composition, hero scenes, hotspot data, Digital Passport and Sera demonstrations, scroll stories, reverse-scroll logic, transitions, navigation, pricing and responsive styling were not redesigned.

The following public experiences all consume the same localized registry:

- Homepage cinematic hero, passport birth story, product demonstrations and industry/use-case cards.
- Individual, Business and Enterprise pages.
- Product, AI Agents, Sera, Digital Passport, Partners, How It Works, About and Security pages.
- All industry and use-case index/detail pages.
- Header and mega-menu preview photography.
- Scroll-driven stories and interactive environment selectors.

## Remaining external dependencies

Marketing images have no remaining external dependency. Google Fonts (`Fraunces` and `Manrope`) remains a separate typography dependency loaded in `src/routes/__root.tsx`; it is not an image, video or animation asset. If the destination must work fully offline, host those fonts separately without changing the approved font choices.

## Download Codebase behaviour and platform limitation

The platform's own **Download Codebase** control cannot be invoked or inspected from this build session, so this document does not claim that its ZIP will preserve newly added public binaries. The supplied `MatrixKeep-portable-source.zip` is the verified alternative: it is assembled from a clean source staging directory and inspected to confirm that it contains the actual image bytes.

If another source export contains only descriptors, use `MatrixKeep-marketing-assets.zip` and Option B above. The original descriptors alone are not required at runtime.

## Protected systems

This localization does not change APIs, backend services, database schemas, authentication, Stripe, pricing data, OpenAI, dashboards, Super Admin, customer records, environment variables, secrets, Google Cloud infrastructure or deployment configuration. Nothing is deployed by the asset archives.

The app-wide automatic preview compilation has pre-existing errors caused by incomplete generated backend type definitions in protected billing, passport and AI files. Those files and the database are deliberately unchanged under this public-asset-only task. Asset integrity and public browser verification are reported separately in `WEBSITE_EXPORT_VERIFICATION.md`.
