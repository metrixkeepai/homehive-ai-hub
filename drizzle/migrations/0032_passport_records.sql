-- Apply the caller's row policies and use stable record IDs for both exports and shares.
CREATE FUNCTION public.passport_records(_subject uuid)
RETURNS SETOF public.home_items
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT r.* FROM public.home_items s
  JOIN public.home_items r ON r.user_id = s.user_id
    AND r.workspace_id IS NOT DISTINCT FROM s.workspace_id AND r.id <> s.id
  WHERE s.id = _subject AND s.user_id = auth.uid()
    AND CASE WHEN s.section IN ('my-home','locations') THEN r.property_id = s.id
      ELSE EXISTS (
        SELECT 1 FROM public.record_links l
        WHERE l.relationship_type <> 'SAME_SOURCE'
          AND ((l.source_item_id = s.id AND l.target_item_id = r.id)
            OR (l.target_item_id = s.id AND l.source_item_id = r.id))
      ) END
$$;
REVOKE ALL ON FUNCTION public.passport_records(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passport_records(uuid) TO authenticated;
