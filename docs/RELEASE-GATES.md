# MatrixKeep release gates

Status: **NO-GO for production**. This branch is a remediation checkpoint, not a completed release.

## Repository and deployment boundary

The source repository is read-only. This repository starts with a new root commit and a source snapshot; it does not inherit source Git history. Real environment files and credentials are excluded. Only the dedicated MatrixKeep Railway staging project may be used for initial deployment. The previous Railway account and production domain remain the rollback boundary and must not be changed before all release gates pass.

## Implemented locally, pending staging verification

- PostgreSQL privileges and RLS for identity, owned workspaces, record links, uploads and Passport sharing.
- Persistent one-time trial history; account-wide database quotas and AI spending reservations.
- Protected Stripe customer bindings, environment checks, official webhook signature verification, atomic event deduplication and subscription updates.
- Direct OpenAI text, vision and speech adapters; authenticated Node WebSocket voice relay with duration, payload and rate limits.
- Node production entry point, readiness and liveness routes, structured request logs and security headers.
- Empty real-data dashboards, workspace-scoped pagination, and explicit unavailable states for unfinished surfaces.

## Required gates before production

1. Green lint, TypeScript, product, security, database, dependency audit and build checks on the exact commit. CI must not bypass failed checks.
2. Isolated Supabase staging project with all migrations applied, generated schema reconciled, real Storage upload tests, backup and restore rehearsal, and concurrent quota tests on server PostgreSQL.
3. Separate staging provider configuration in Railway's secret store: Supabase, restricted OpenAI key, Stripe sandbox credentials and signed webhook. No credentials in source, public VITE variables, build logs or this document.
4. Stripe sandbox catalogue reconciliation and end-to-end checkout, failed payment, cancellation, portal, return URL, duplicate delivery and delayed delivery tests.
5. Authenticated desktop/mobile browser tests for capture, records, uploads, deep links, Passport expiry/revocation and guest isolation; Google OAuth and import tests.
6. Voice/browser/audio tests, transcription quality checks, measured provider cost accounting, bounded concurrent requests and load measurements. Cost reservations alone are not invoice reconciliation.
7. Remaining product features, pagination/global search correctness, transactional Passport email and audit findings completed or explicitly approved for exclusion. An unavailable message is not a completed feature.
8. Exact-commit staging deployment reports SUCCESS and passes TLS, readiness, functionality, performance and rollback checks.
9. Owner-configured branch protection and required checks, production provider reconciliation, production backups and cutover only after all acceptance evidence passes.

The runtime defaults AI spending to disabled and billing environment to unconfigured in the database. Enable/configure them only in the correct isolated environment after credentials, catalogue and limits have been checked. Health readiness fails closed until the database prerequisites exist.

No production readiness, provider success, deployment success or capacity claim is established by local tests alone.
