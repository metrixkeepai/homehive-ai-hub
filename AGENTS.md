<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Signed-in app pages live under src/routes/_authenticated/ (client-only gate redirecting to /auth); user-added records are stored in one generic home_items table keyed by section slug, so new sections need no schema change.
- Account type (individual/business) lives on profiles.account_type; business-only menu sections are flagged with `only: "business"` in data.ts so they reuse the generic home_items storage.
- Records are scoped to a workspace via home_items.workspace_id (null = the user's personal workspace from their profile); the active workspace lives in StoreProvider so every page filters the same way.
- AI calls (Sera, Add anything capture) run in createServerFn handlers under src/lib/*.functions.ts so the AI key never reaches the browser.
- Voucher codes are redeemed only through the redeem_voucher database function; the vouchers table has no client policies so codes can't be listed.
- Account navigation is grouped through one shared workspace-aware navigation definition so individual and organisation menus cannot diverge across screen sizes.
- Warranty and renewal records use home_items fields with ISO calendar dates; tracking pages show only saved workspace records and calculate statuses from dates, not sample counts.
- Calendar reminders are downloadable ICS files, not claims of connected email or push notification delivery.
- Plans, prices and capacities come from one shared plan list (src/lib/plans.ts) so public pricing, in-app plans and billing never disagree.
- Super Admin portal lives at /super-admin/* (own layout, own login); every admin server function re-checks has_role(super_admin) before using the privileged client, and every change writes admin_audit_log.
- First Super Admin is bootstrapped at server start from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD (see server/ensure-super-admin.mjs); without those env vars the Control Centre has no operator account.
- Provider-backed admin figures (Stripe, AWS, Azure) load only when their secrets exist; otherwise the UI shows a Setup Required state instead of estimates.
- Sera voice calls use the Node /api/live relay (server/voice.mjs). Upgrade authentication and PostgreSQL quota reservation precede the direct OpenAI connection; the relay enforces a five-minute maximum and workspace-scoped retrieval. server/start.mjs hosts Nitro node-middleware and the WebSocket server.
- Google (Gmail, Calendar, Drive) uses per-user App User Connectors: each user's connection key is stored encrypted in app_user_connections (service-role only) and every Google call runs in src/lib/google.functions.ts, so tokens never reach the browser.
- Plan product access comes from the feature catalogue in src/lib/entitlements.ts (defaults per plan tier) overridden by the latest approved plan_versions.entitlements; benefits text stays marketing-only so copy edits never change access.
- Shared passports store a frozen HTML snapshot in passport_shares and guests read it only via the open_passport_share function, so a link never exposes live workspace data.
