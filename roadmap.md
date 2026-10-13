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
# Multi-property & Smart Calendar
- [x] Add/edit/archive/delete properties and locations with plan limits
- [x] Link rooms, assets and records to a property (forms, Add anything, detail page, filters, Unassigned)
- [x] Smart Calendar with month/list views, filters, upcoming panel, .ics export
- [ ] Calendar email/push alerts — blocked: email domain
