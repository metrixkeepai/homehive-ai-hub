# MatrixKeep transactional email

Generate the complete customer preview set and native Auth templates locally:

    node server/email/export.mjs staging ./email-staging
    node server/email/export.mjs production ./email-production
    node --test server/email/email.test.mjs

Open index.html in either output. Examples use invented customer records and inactive authentication tokens. Never install an example as a live template. The auth directory contains native templates for confirmation, recovery, invite and the two post-change security notifications. Keep the separate email-change confirmation template when configuring the post-change notification. The subjects file contains display patterns for application templates and literal subjects for the five Auth templates. Configure the sending identity as MatrixKeep <hello@matrixkeep.com> and use hello@matrixkeep.com for replies. Native Auth templates preserve the signed confirmation URL. Configure each project's Site URL and allowed return URLs for its environment.

For application mail, renderEmail returns subject, preheader, from, replyTo, html and text. Send the bodies as multipart/alternative. Pass display-ready values from committed application records, including formatted currency, dates and timezone. Required narrative fields fail before dispatch if missing. Optional metadata rows disappear when absent. Never pass raw webhook objects or use user-edited metadata for permissions. Templates are presentation only.

Migration 0045 queues one welcome message when an account first confirms its email address, and one voucher message when a redemption commits. There is no backfill. The ledger stores a hash per environment, event kind, logical occurrence and recipient. Inspect provider acceptance before manually reconciling a claimed or uncertain send. Application mail sends both plain text and HTML. The staging hosted Auth recovery message was delivered as HTML only.

The protected staging verification deploys the mail job when the staging environment variable MATRIXKEEP_MAIL_WORKER_ENABLED is true. It uses the dedicated matrixkeep-mail staging service account, with Secret Manager access limited to MAIL_DATABASE_URL, MATRIXKEEP_SMTP_HOST, MATRIXKEEP_SMTP_PORT, MATRIXKEEP_SMTP_USER and MATRIXKEEP_SMTP_PASSWORD. Provision the DB login as a member of matrixkeep_mail_sender. Configure port 465 (implicit TLS) or 587 (STARTTLS). Keep the sender as MatrixKeep <hello@matrixkeep.com>. The script pins the worker image and secret versions and schedules the job every five minutes after its first successful run. This integration is staging-only.

Payment received, payment failed, activation, upgrade, downgrade, renewal, cancellation and trial-ending mail are all suppressed in the MatrixKeep sender by default. This leaves equivalent customer notifications with Stripe wherever enabled in that environment. Do not claim that Stripe sends an individual event until its notification settings and actual delivery have been verified.

Hosted Auth templates are configured separately in each project. Verify delivered MIME parts and action links with a staging test account before applying production configuration. Run the focused transport tests with `python -m unittest discover -s server/email -p test_smtp.py` and `node --test server/email/email.test.mjs`.
