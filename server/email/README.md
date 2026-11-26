# MatrixKeep transactional email

Generate the complete customer preview set and native Auth templates locally:

    node server/email/export.mjs staging ./email-staging
    node server/email/export.mjs production ./email-production
    node --test server/email/email.test.mjs

Open index.html in either output. Examples use invented customer records and inactive authentication tokens. Never install an example as a live template. The auth directory contains native templates for confirmation, recovery, invite and the two post-change security notifications. Keep the separate email-change confirmation template when configuring the post-change notification. The subjects file contains display patterns for application templates and literal subjects for the five Auth templates. Configure the sending identity as MatrixKeep <hello@matrixkeep.com> and use hello@matrixkeep.com for replies. Native Auth templates preserve the signed confirmation URL. Configure each project's Site URL and allowed return URLs for its environment.

For application mail, renderEmail returns subject, preheader, from, replyTo, html and text. Send the bodies as multipart/alternative. Pass display-ready values from committed application records, including formatted currency, dates and timezone. Required narrative fields fail before dispatch if missing. Optional metadata rows disappear when absent. Never pass raw webhook objects or use user-edited metadata for permissions. Templates are presentation only.

To enable event delivery, install delivery.sql using the server migration process, allow only the sending identity to read/insert/update the ledger, and connect deliverEmail to the actual mail transport and event producers. Use a stable business occurrence per recipient: confirmed account, subscription transition, paid invoice, failed payment attempt, voucher redemption or reminder due date. The ledger keys are hashes; no action links or message bodies are stored. A claimed or uncertain delivery after an interrupted process requires checking provider acceptance before retrying. Equivalent billing mail defaults to externally managed. Set a per-kind billing owner to matrixkeep only after checking and disabling the equivalent customer email in the relevant payment environment. Keep one sender for Auth events too.

An application deployment alone does not install hosted Auth templates, enable their notification toggles, install the ledger or activate a mail worker. The HTML and text exports are separate. For transports that expose only an HTML editor, verify the delivered MIME parts or use a multipart-capable sending hook. Test with staging accounts before rollout.
