# Enabling MatrixKeep live billing

Set STRIPE_ACCOUNT_ID in the protected production environment to the dedicated MatrixKeep account ID from its Stripe Dashboard. Confirm the publishable key, server key, live webhook signing secret, endpoint, Portal and catalogue belong to that merchant. The production revision checks the server key against Stripe at startup. Keep staging in sandbox.

With the production database singleton still disabled, use scripts/reconcile-live-catalogue.mjs in read-only mode against that merchant. Review its results before using --apply to create missing prices. Enable LIVE_BILLING_VERIFIED only after provisioning the live credentials, configuring the signed webhook and verifying the catalogue and Portal. Use the protected deployment workflow. Verify the new production revision serves traffic, the public configuration uses the live publishable key and the webhook handler is available.

Activate the production runtime_limits singleton from disabled to live only after the verified revision serves traffic. Confirm exactly one row changed and the normal application can create a session at the approved price. A return to the application does not confirm payment. An owner-controlled transaction and its verified webhook complete payment certification.

To stop new checkout creation, revert the production singleton to disabled. Record events in flight before rollback. Set LIVE_BILLING_VERIFIED=false and use the protected deployment path for a credential-free disabled revision. Reconcile outstanding events against Stripe before re-enabling. Never replay a customer email blindly.
