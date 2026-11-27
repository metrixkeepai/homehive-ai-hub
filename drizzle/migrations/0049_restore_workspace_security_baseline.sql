-- 0018 established these policies, grants and functions. Preserve later hardening.
-- Fail replay if the baseline is incomplete, without regranting obsolete profile access.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('trial_history','own trial history'), ('home_items','authorised workspace items'),
      ('workspaces','active owner workspaces'), ('evidence_files','authorised evidence'),
      ('record_links','authorised record links')
    ) AS expected(rel, policy)
    WHERE NOT EXISTS (
      SELECT FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
      WHERE c.oid=to_regclass('public.' || expected.rel) AND c.relrowsecurity
        AND p.polname=expected.policy
    )
  ) OR to_regprocedure('public.start_business_trial()') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.has_active_subscription(uuid,text)') IS NULL
    OR to_regprocedure('public.can_access_workspace(uuid)') IS NULL
    OR to_regclass('public.home_items_workspace_section_created') IS NULL
    OR to_regclass('public.evidence_files_user_item') IS NULL
    OR has_table_privilege('authenticated','public.trial_history','INSERT')
    OR NOT has_table_privilege('authenticated','public.trial_history','SELECT')
  THEN
    RAISE EXCEPTION 'Incomplete identity/workspace security baseline from migration 0018';
  END IF;
END $$;
