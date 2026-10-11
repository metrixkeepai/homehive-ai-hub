CREATE TABLE public.passport_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  html text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_shares TO authenticated;
GRANT ALL ON public.passport_shares TO service_role;
ALTER TABLE public.passport_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shares" ON public.passport_shares FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.open_passport_share(_token text)
RETURNS TABLE (title text, html text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE passport_shares s SET views = s.views + 1 WHERE s.token = _token AND NOT s.revoked AND s.expires_at > now();
  RETURN QUERY SELECT s.title, s.html, s.expires_at FROM passport_shares s WHERE s.token = _token AND NOT s.revoked AND s.expires_at > now();
END $$;
REVOKE ALL ON FUNCTION public.open_passport_share(text) FROM public;
GRANT EXECUTE ON FUNCTION public.open_passport_share(text) TO anon, authenticated;