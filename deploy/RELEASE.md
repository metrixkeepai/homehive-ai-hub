# MatrixKeep Cloud Run release

CI installs with Bun 1.4.3 and the committed bun.lock. The Node host starts with npm start. The web image and migration image are built from one Git commit. Neither build receives provider credentials. Browser configuration is supplied by the deployed Node host from four allowlisted values.

## Staging identity

From a Google Cloud Shell signed in to the intended billing account, run the checked-out deploy/bootstrap-staging.sh with Bash. It uses the dedicated matrixkeep-staging project by default. An optional first argument selects a globally unique matrixkeep-staging-prefixed ID. An optional second argument selects the billing account when more than one is open. The script creates the registry, restricted GitHub federation, per-service accounts and empty Secret Manager entries. It prints the four non-secret variables for the GitHub staging environment.

The staging database ref is cdfpupivjjamhvmfcvry. The migration job accepts direct or session-pooler connections to that project, applies the journal under a database lock, and has exclusive access to the migration credential. The web service requires the matching Supabase URL, publishable key and service-role credential. Configure new secret versions at the provider and in Secret Manager. Staging payments need all three sandbox values. For Google user connectors preserve the existing encryption key for existing ciphertext, or re-encrypt/reconnect users during a controlled rotation.

Protect the GitHub production environment. Bind its deployment identity to this repository's immutable owner/repository IDs, the production environment, main and promote.yml. The production deployer needs read access to the dedicated staging image repository for digest promotion. Set the environment's GCP_PROJECT_ID, GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_DEPLOY_SERVICE_ACCOUNT, production SUPABASE_PROJECT_REF and optional GCP_REGION. Set MONITORING_CHANNEL to a verified Cloud Monitoring notification-channel resource in the matching project for paging. Readiness, HTTP 5xx, CPU, memory, latency and instance-limit policies are project-specific.

## Acceptance and rollback

The staging manifest records exact source, image manifests, revision, region and origin after actual TLS and health verification. Protected application flows, OAuth, test billing and OpenAI require separate end-to-end evidence. The manual production workflow accepts a successful staging run for the selected main SHA. Its acceptance reference must identify the functional evidence, verified backup and credential rotation. Leave LIVE_BILLING_VERIFIED unset until the live catalogue, modes, webhook endpoint and portal have been checked. Without it, the service omits all Stripe credentials.

Before production migration record the Supabase plan, last successful managed backup or PITR restore point, retention window, and a completed isolated restore rehearsal. Configure the private evidence bucket with a 20 MiB limit and the application MIME allowlist. Back up Storage object bytes separately from database metadata. Record old Cloud Run traffic assignments, domain mapping and DNS before cutover.

On an application regression, return Cloud Run traffic to the previous verified revision and confirm both health endpoints and core workflows. Existing revisions retain their pinned secret versions. Never re-enable an exposed credential to roll back. Drizzle migrations are forward-only. Prefer a compatible corrective migration. If a database restore is necessary, stop writes, restore into an isolated target using the verified backup/PITR point, reconcile post-backup data and object storage, verify schema and tenant access, then approve cutover. A traffic rollback alone does not reverse database changes.
