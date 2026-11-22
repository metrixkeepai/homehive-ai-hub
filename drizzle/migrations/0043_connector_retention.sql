CREATE FUNCTION public.purge_expired_connector_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
DELETE FROM public.connector_oauth_requests WHERE expires_at < now();
DELETE FROM public.connector_reviews WHERE state IN ('pending','rejected') AND coalesce(reviewed_at,created_at)<now()-interval '90 days';
UPDATE public.connector_reviews SET proposals='[]',source='[]',attachment=NULL WHERE state='approved' AND reviewed_at<now()-interval '90 days' AND (proposals<>'[]' OR source<>'[]' OR attachment IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.purge_expired_connector_data() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_connector_data() TO service_role;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_extension WHERE extname='pg_cron') THEN PERFORM cron.schedule('matrixkeep-connector-retention','17 2 * * *','select public.purge_expired_connector_data()'); END IF; END $$;
