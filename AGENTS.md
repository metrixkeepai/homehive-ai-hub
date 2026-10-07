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
