CREATE TABLE public.evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  item_id uuid NOT NULL REFERENCES public.home_items(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  mime text NOT NULL DEFAULT '',
  size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT ALL ON public.evidence_files TO service_role;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence all" ON public.evidence_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own evidence read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own evidence write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own evidence delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);