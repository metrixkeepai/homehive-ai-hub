CREATE OR REPLACE FUNCTION public.enforce_item_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ent jsonb; feature text; cap numeric; used bigint; cfg jsonb;
BEGIN
  -- Stable lock serializes concurrent inserts and moves across all of an account's workspaces.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 1));
  IF NEW.workspace_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND owner_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Workspace unavailable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.section IS DISTINCT FROM OLD.section) THEN
    RAISE EXCEPTION 'Record scope is immutable' USING ERRCODE = '42501';
  END IF;
  ent := public.account_entitlements(NEW.user_id);
  IF octet_length(NEW.fields::text) > 65536 OR jsonb_typeof(NEW.fields) <> 'array' THEN RAISE EXCEPTION 'Invalid record fields'; END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  feature := CASE NEW.section
    WHEN 'my-home' THEN 'properties' WHEN 'properties' THEN 'properties'
    WHEN 'rooms' THEN 'rooms' WHEN 'assets' THEN 'assets' WHEN 'equipment' THEN 'equipment'
    WHEN 'vehicles' THEN 'vehicles' WHEN 'documents' THEN 'documents' WHEN 'locations' THEN 'locations'
    WHEN 'team' THEN 'users' WHEN 'family' THEN 'users' WHEN 'departments' THEN 'departments'
    WHEN 'insurance' THEN 'insurance_evidence_inventory'
    WHEN 'contracts' THEN 'contract_management' WHEN 'certificates' THEN 'certificate_tracking'
    WHEN 'suppliers' THEN 'supplier_records'
    WHEN 'warranties' THEN 'assets' WHEN 'renewals' THEN 'assets'
    WHEN 'services' THEN 'assets' WHEN 'maintenance' THEN 'assets' WHEN 'tasks' THEN 'assets'
    ELSE NULL END;
  IF feature IS NULL THEN RAISE EXCEPTION 'This record type is not available' USING ERRCODE = '42501'; END IF;
  cfg := ent->feature;
  IF coalesce((cfg->>'on')::boolean, false) = false THEN RAISE EXCEPTION 'Plan feature unavailable' USING ERRCODE = '42501'; END IF;
  IF cfg->>'limit' IS NOT NULL THEN
    cap := (cfg->>'limit')::numeric;
    IF cap < 0 THEN RAISE EXCEPTION 'Invalid plan capacity'; END IF;
    SELECT count(*) INTO used FROM public.home_items WHERE user_id = NEW.user_id
      AND (section = NEW.section OR (feature = 'properties' AND section IN ('my-home','properties')));
    IF used >= cap THEN RAISE EXCEPTION 'Plan capacity reached' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END $$;
