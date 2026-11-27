# MatrixKeep public website review

## Preview

https://id-preview--d9e9be84-0788-4045-8daf-034761894e0d.lovable.app

Production was not published or deployed.

## Delivered

- Reworked Home, Individual, Business, Enterprise, Platform, How It Works, Pricing, Security, About, Contact, industry and use-case pages.
- New public routes: /ai-agents, /sera, /digital-passport, /partners.
- Expanded industry coverage with Dental, Warehousing & Logistics, Automotive & Fleet and Homeowners & Families; expanded use cases with Business Asset Management, Compliance Evidence, Property Asset Intelligence and Important Documents.
- Public-only light presentation preserves the logo, existing brand colours and Fraunces/Manrope typography. Photographic page introductions, connected-record previews, accessible desktop/mobile menus, full footer, meaningful reveal transitions and reduced-motion support.
- 14 generated photographic assets stored through the project asset service. Media CLI used for generation; industry and product sheets were cropped into individual photographs.
- Seven selectable Digital Passport examples, personal/business scripted Sera answers and a six-input business ROI calculator. All examples are labelled illustrative and do not call AI or customer-data APIs.
- Pricing uses the existing plan catalogue while published updates load, retains current inactive-plan filtering and reuses the existing approved-entitlement comparison. Signup and subscription links use existing authentication. Contact retains the existing mail-app enquiry mechanism.
- Unique public metadata, matching visible social images, canonical links, WebSite structured data and a static 42-page public sitemap. Legal content unchanged; legal metadata enhanced.

## Verified

- All 42 public URLs returned 200 and rendered one H1.
- All 42 pages checked at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 pixels: no horizontal overflow.
- 42 distinct internal link targets checked: no HTTP errors.
- Desktop Product menu and mobile expandable Product menu navigate correctly. Escape dismisses navigation.
- Seven Passport selections display their corresponding records. Personal and Business Sera questions display matching scripted answers.
- ROI inputs 3 employees, 4 hours, £25/hour, 50% reduction, £29/month, 48 weeks read back £6,852 net annual capacity benefit. Three pure calculation tests pass.
- Existing catalogue Business monthly prices £19/£29/£79/£149 and annual prices £190/£290/£790/£1,490 display correctly. Choose Business navigates to existing authentication.
- Contact controls have accessible associated labels. No automated axe violations for the tested WCAG 2/2.1 A/AA and best-practice rules on Home, Individual, Business, Enterprise, Passport, Sera, Pricing, Contact, Dental and Privacy. This is not a full WCAG 2.2 certification.
- No page errors in tested public browser flows; no broken loaded images. Reduced-motion media disables hero animation.
- Existing /auth displays Welcome back. Signed-in /app displays the existing workspace overview with no marketing wrapper. No records or payments were changed.

## Limitations

- A clean production build is NOT verified. The automatic checker already reported substantial generated database schema/type mismatches before this work, including protected Billing, PassportModal, admin operations and AI accounting. The latest check contains no errors in the new marketing components, but those pre-existing protected-system errors remain. They were not hidden or changed under this public-only request.
- Live published-catalogue updates were not successfully returned during browser QA. Existing shared plan definitions display as the explicitly stated fallback; published feature-update freshness is unverified. Current plan details must be confirmed in the account before purchase.
- Lighthouse performance was not measured; no 90+ performance claim is made. Generated photos are reused where relevant; some closely related sectors share an environment.
- Email enquiries open the existing email app; no new email API or automatic outbound delivery was added.
- Full manual assistive-technology testing, every menu keyboard sequence and live payment/provider consent flows are unverified.
- Advanced compliance assurance, evidence verification, risk and remediation are marked roadmap; no customers, endorsements, compliance guarantees or proven savings are fabricated.

## Changed-file scope

Public route files; public Site/StoryPage/siteContent; new components/marketing modules and calculator test; new marketing asset pointers; scoped src/styles.css additions; static sitemap/robots; AGENTS.md; roadmap.md; this report.

No authentication logic, APIs, backend services, database migrations, generated clients/types, Stripe integrations, protected application pages, Super Admin, environment variables or deployment configuration were edited for this transformation. A pre-existing sandbox-managed bun.lock update is unrelated to the website work.
