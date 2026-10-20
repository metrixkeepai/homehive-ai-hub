ALTER TABLE public.passport_shares ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.passport_shares ADD COLUMN item_id uuid REFERENCES public.home_items(id) ON DELETE CASCADE;
REVOKE UPDATE ON public.passport_shares FROM authenticated;
GRANT UPDATE(revoked) ON public.passport_shares TO authenticated;
CREATE FUNCTION public.guard_passport_share() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.item_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.home_items WHERE id=NEW.item_id AND user_id=NEW.user_id AND workspace_id IS NOT DISTINCT FROM NEW.workspace_id) THEN RAISE EXCEPTION 'Share record unavailable' USING ERRCODE='42501'; END IF;
  IF NEW.expires_at<=now() OR NEW.expires_at>now()+interval '30 days' OR octet_length(NEW.html)>1000000 OR char_length(NEW.title)>250 THEN RAISE EXCEPTION 'Invalid share'; END IF;
  PERFORM public.reserve_operation(NEW.user_id,NEW.workspace_id,'share',1);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_passport_share() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER passport_share_guard BEFORE INSERT ON public.passport_shares FOR EACH ROW EXECUTE FUNCTION public.guard_passport_share();
CREATE OR REPLACE FUNCTION public.open_passport_share(_token text)
RETURNS TABLE(title text,html text,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _token !~ '^[0-9a-f]{48}$' THEN RETURN; END IF;
  RETURN QUERY UPDATE public.passport_shares s SET views=s.views+1
    WHERE s.token=_token AND NOT s.revoked AND s.expires_at>now()
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=s.user_id AND NOT p.suspended)
    RETURNING s.title,s.html,s.expires_at;
END $$;

-- Supabase Storage owns metadata; clients cannot select a smaller recorded size.
CREATE FUNCTION public.enforce_storage_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage,pg_temp AS $$
DECLARE uid uuid; item uuid; ent jsonb; cap numeric; used numeric; bytes bigint; mime text;
BEGIN
  IF NEW.bucket_id<>'evidence' THEN RETURN NEW; END IF;
  uid:=split_part(NEW.name,'/',1)::uuid; item:=split_part(NEW.name,'/',2)::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,1));
  ent:=public.account_entitlements(uid);
  IF NOT EXISTS(SELECT 1 FROM public.home_items WHERE id=item AND user_id=uid) THEN RAISE EXCEPTION 'Upload record unavailable' USING ERRCODE='42501'; END IF;
  IF coalesce(NEW.metadata->>'size','') !~ '^[0-9]{1,10}$' THEN RAISE EXCEPTION 'Upload size unavailable'; END IF;
  bytes:=(NEW.metadata->>'size')::bigint; mime:=NEW.metadata->>'mimetype';
  IF bytes>20971520 OR bytes<=0 OR mime NOT IN ('image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain') OR mime IS NULL THEN RAISE EXCEPTION 'Unsupported upload'; END IF;
  IF NOT coalesce((ent->'storage'->>'on')::boolean,false) THEN RAISE EXCEPTION 'Storage unavailable' USING ERRCODE='42501'; END IF;
  cap:=(ent->'storage'->>'limit')::numeric * CASE ent->'storage'->>'unit' WHEN 'MB' THEN 1048576 WHEN 'GB' THEN 1073741824 WHEN 'TB' THEN 1099511627776 ELSE 0 END;
  SELECT coalesce(sum(coalesce((metadata->>'size')::numeric,0)),0) INTO used FROM storage.objects WHERE bucket_id='evidence' AND split_part(name,'/',1)=uid::text AND id IS DISTINCT FROM NEW.id;
  IF cap IS NOT NULL AND used+bytes>cap THEN RAISE EXCEPTION 'Storage quota reached' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_storage_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER evidence_storage_capacity BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_capacity();
DROP POLICY "own evidence read" ON storage.objects;
CREATE POLICY "own evidence read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='evidence' AND split_part(name,'/',1)=auth.uid()::text AND public.can_access_workspace(NULL));

CREATE FUNCTION public.production_readiness() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT EXISTS(SELECT 1 FROM public.runtime_limits WHERE singleton AND billing_environment IS NOT NULL)
  AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='home_items_capacity')
  AND NOT has_table_privilege('authenticated','public.profiles','UPDATE')
$$;
REVOKE ALL ON FUNCTION public.production_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.production_readiness() TO service_role;
