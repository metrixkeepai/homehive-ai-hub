CREATE TABLE public.billing_action_locks (
  action_key text PRIMARY KEY, token uuid NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE public.billing_action_locks ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_billing_action(_key text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  INSERT INTO public.billing_action_locks VALUES (_key,gen_random_uuid(),now()+interval '10 minutes')
  ON CONFLICT(action_key) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at
  WHERE billing_action_locks.expires_at<now() RETURNING token
$$;
CREATE FUNCTION public.release_billing_action(_key text,_token uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  DELETE FROM public.billing_action_locks WHERE action_key=_key AND token=_token
$$;
CREATE TABLE public.billing_price_history (
  environment text NOT NULL, price_id text NOT NULL, plan_key text NOT NULL, product_id text NOT NULL,
  amount integer NOT NULL CHECK(amount>0), interval_name text NOT NULL CHECK(interval_name IN ('month','year')),
  PRIMARY KEY(environment,price_id)
);
ALTER TABLE public.billing_price_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.billing_price_history TO service_role;
CREATE FUNCTION public.published_plan_catalogue()
RETURNS TABLE(plan_key text,name text,audience text,monthly numeric,yearly numeric,capacity jsonb,benefits text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT DISTINCT ON (v.plan_key) v.plan_key,v.name,v.audience,v.monthly,v.yearly,v.capacity,v.benefits
 FROM public.plan_versions v WHERE v.status='approved' ORDER BY v.plan_key,v.version DESC
$$;
CREATE FUNCTION public.approve_catalogue_version(_id uuid,_admin uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.plan_versions;
BEGIN
 SELECT * INTO STRICT v FROM public.plan_versions WHERE id=_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_admin AND role='super_admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 INSERT INTO public.plan_defaults(plan_key,entitlements) VALUES(v.plan_key,coalesce(v.entitlements,'{}'::jsonb)) ON CONFLICT DO NOTHING;
 UPDATE public.plan_versions SET status='archived' WHERE plan_key=v.plan_key AND id<>v.id AND status='approved';
 UPDATE public.plan_versions SET status='approved' WHERE id=_id;
 INSERT INTO public.admin_audit_log(admin_id,action,target,details) VALUES (_admin,'plan_version_approved',v.plan_key,jsonb_build_object('version',v.version));
END $$;
REVOKE ALL ON FUNCTION public.claim_billing_action(text),public.release_billing_action(text,uuid),public.approve_catalogue_version(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_action(text),public.release_billing_action(text,uuid),public.approve_catalogue_version(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.published_plan_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_plan_catalogue() TO anon,authenticated,service_role;

-- The staging job stores only check names and bounded status codes.
CREATE TABLE public.release_qa_checks (
 run_id text NOT NULL, check_name text NOT NULL, outcome text NOT NULL, PRIMARY KEY(run_id,check_name)
);
ALTER TABLE public.release_qa_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.release_qa_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.release_qa_checks TO service_role;
