ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_source text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS org_size text,
  ADD COLUMN IF NOT EXISTS branches integer;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'individual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspaces" ON public.workspaces FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE TABLE public.vouchers (
  code text PRIMARY KEY,
  plan text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  max_uses integer NOT NULL DEFAULT 100,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.redeem_voucher(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vouchers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v FROM public.vouchers WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND OR NOT v.active OR v.uses >= v.max_uses THEN RETURN NULL; END IF;
  UPDATE public.vouchers SET uses = uses + 1 WHERE code = v.code;
  UPDATE public.profiles SET plan = v.plan, plan_source = 'voucher:' || v.code, updated_at = now() WHERE id = auth.uid();
  RETURN v.plan;
END; $$;
REVOKE ALL ON FUNCTION public.redeem_voucher(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, avatar_url, account_type, org_name, sector, business_type, org_size, branches)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'account_type' in ('business','enterprise') then new.raw_user_meta_data->>'account_type' else 'individual' end,
    left(new.raw_user_meta_data->>'org_name', 200),
    left(new.raw_user_meta_data->>'sector', 100),
    left(new.raw_user_meta_data->>'business_type', 100),
    left(new.raw_user_meta_data->>'org_size', 50),
    case when (new.raw_user_meta_data->>'branches') ~ '^[0-9]{1,5}$' then (new.raw_user_meta_data->>'branches')::int else null end)
  on conflict (id) do nothing;
  return new;
end; $function$;