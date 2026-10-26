-- Supabase Storage inserts objects with partial metadata (mimetype + contentLength),
-- then updates with full metadata including size. The capacity trigger must allow
-- that INSERT and validate size on UPDATE (or when size/contentLength is present).
CREATE OR REPLACE FUNCTION public.enforce_storage_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, pg_temp AS $$
DECLARE
  uid uuid;
  item uuid;
  ent jsonb;
  cap numeric;
  used numeric;
  bytes bigint;
  mime text;
  size_txt text;
BEGIN
  IF NEW.bucket_id <> 'evidence' THEN RETURN NEW; END IF;
  uid := split_part(NEW.name, '/', 1)::uuid;
  item := split_part(NEW.name, '/', 2)::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  ent := public.account_entitlements(uid);
  IF NOT EXISTS (SELECT 1 FROM public.home_items WHERE id = item AND user_id = uid) THEN
    RAISE EXCEPTION 'Upload record unavailable' USING ERRCODE = '42501';
  END IF;

  size_txt := coalesce(NEW.metadata->>'size', NEW.metadata->>'contentLength', '');
  -- Storage's first write often has no size yet; validate on the later UPDATE.
  IF size_txt = '' AND TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF size_txt !~ '^[0-9]{1,10}$' THEN RAISE EXCEPTION 'Upload size unavailable'; END IF;

  bytes := size_txt::bigint;
  mime := NEW.metadata->>'mimetype';
  IF bytes > 20971520 OR bytes <= 0
    OR mime NOT IN (
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'text/plain'
    )
    OR mime IS NULL
  THEN
    RAISE EXCEPTION 'Unsupported upload';
  END IF;
  IF NOT coalesce((ent->'storage'->>'on')::boolean, false) THEN
    RAISE EXCEPTION 'Storage unavailable' USING ERRCODE = '42501';
  END IF;
  cap := (ent->'storage'->>'limit')::numeric * CASE ent->'storage'->>'unit'
    WHEN 'MB' THEN 1048576
    WHEN 'GB' THEN 1073741824
    WHEN 'TB' THEN 1099511627776
    ELSE 0
  END;
  SELECT coalesce(sum(coalesce((metadata->>'size')::numeric, (metadata->>'contentLength')::numeric, 0)), 0)
    INTO used
  FROM storage.objects
  WHERE bucket_id = 'evidence'
    AND split_part(name, '/', 1) = uid::text
    AND id IS DISTINCT FROM NEW.id;
  IF cap IS NOT NULL AND used + bytes > cap THEN
    RAISE EXCEPTION 'Storage quota reached' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Storage updates object metadata after INSERT; allow owners to UPDATE their evidence objects.
DROP POLICY IF EXISTS "own evidence update" ON storage.objects;
CREATE POLICY "own evidence update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'evidence' AND split_part(name, '/', 1) = auth.uid()::text AND public.can_access_workspace(NULL))
WITH CHECK (bucket_id = 'evidence' AND split_part(name, '/', 1) = auth.uid()::text AND public.can_access_workspace(NULL));
