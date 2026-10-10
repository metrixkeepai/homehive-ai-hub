CREATE TABLE public.record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  workspace_id uuid,
  source_item_id uuid NOT NULL REFERENCES public.home_items(id) ON DELETE CASCADE,
  target_item_id uuid NOT NULL REFERENCES public.home_items(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  source_document_id uuid REFERENCES public.home_items(id) ON DELETE SET NULL,
  source_extraction_id uuid,
  source_capture_type text,
  confidence numeric,
  confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, target_item_id, relationship_type)
);
CREATE INDEX record_links_source_idx ON public.record_links(source_item_id);
CREATE INDEX record_links_target_idx ON public.record_links(target_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_links TO authenticated;
GRANT ALL ON public.record_links TO service_role;
ALTER TABLE public.record_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links all" ON public.record_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);