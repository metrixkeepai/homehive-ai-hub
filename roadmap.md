# Account experience updates

- [x] Organise individual and business side menus into categories with collapsible navigation.
- [x] Implement saved warranty and renewal tracking, real date-based statuses, editing and calendar reminders.
- [x] Refresh sign-in and sign-up without replacing authentication.
- [x] Verify signed-in tracking and both account menus; check sign-in/sign-up layouts.

# Super Admin remaining spec

- [x] Account usage & history on subscriber page (storage, documents, limits, overrides, subscription history)
- [x] Billing section (overview + 9 sub-pages, Stripe-backed)
- [x] Voucher engine upgrade
- [x] Dashboard charts and widgets (subscribers, subscriptions & revenue charts (after vouchers)
- [x] Products + checkout: plan products created in payments
- [ ] Ask user: business logic on purchase, subscribe, cancel, upgrade/downgrade
- [x] Embedded checkout on Plans page + webhook handler + subscriptions table
- [ ] Relationship graph spec: remaining sections (line items, evidence sync, Super Admin CRUD, entitlement engine, feature gating, country/business-upgrade fixes)
- [x] Delete own records (rooms, vehicles, assets, any section) from list and detail pages
- [x] Plan limits enforced on adding assets/documents/locations/team with Upgrade prompt
- [x] Separate line items on documents
- [x] Evidence fixes across the whole app (AI-read new evidence, update Overview after confirm)
- [x] Full add/edit/delete in Super Admin
- [x] Feature switches gating features + upgrade prompts on locked features
- [x] Country field and Individual-to-Business upgrade fixes

# Digital passports

- [x] Centred download window (format cards, report type, sections, privacy)
- [x] Secure expiring share links, revoke, guest view
- [x] Asset, vehicle and location passports
- [ ] MatrixKeep-sent emails — blocked: needs an email domain
- [x] Document intelligence: contract/renewal extraction, date calc, more file types
- [x] Old Office/TIFF reading, multi-point reminders, duplicates, versions, rename/archive, document type filters
- [ ] Automatic email and WhatsApp alerts — blocked: email domain / WhatsApp Business account

# Public website transformation

# Cinematic public website

- [x] Restore dark header, interactive mega menus and original premium pricing presentation.
- [x] Add three-scene hero, motion controls, scroll and pointer-responsive storytelling.
- [x] Enhance passports, Sera, intelligence and audience/location demonstrations.
- [x] Replace duplicate primary imagery and maintain an image manifest.
- [x] Verify public routes, interactions, responsive layouts and reduced motion; report measured limitations.

- [x] Isolated public design, navigation and photography
- [x] Complete homepage and audience pages
- [x] Product, industry, use-case and company marketing pages
- [x] Passport, scripted Sera and business ROI demonstrations
- [x] Existing catalogue pricing, metadata, responsive and interaction QA
- [x] Report limitations and confirm protected systems unchanged
- [x] Restore missing server schema and generated types; full application typecheck passes.

# Portable public website assets

- [x] Discover every managed pointer, local media file and external marketing dependency.
- [x] Retrieve original binaries without changing their visual content and store them under public/images/marketing/.
- [x] Replace only public marketing asset references; preserve all interactions and protected systems.
- [x] Create a machine-readable manifest, reference mapping and migration instructions.
- [x] Verify image integrity, all 42 public routes and interactive motion behavior.
- [x] Verify portable source/asset ZIP contents, extracted checksums and independent static HTTP serving.
- [x] Clean application typecheck after restoring protected server schema and generated types.
