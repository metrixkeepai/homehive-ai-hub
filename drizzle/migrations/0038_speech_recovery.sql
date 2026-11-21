CREATE OR REPLACE FUNCTION public.reserve_ai_retry(_id uuid,_user uuid,_estimate numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE day_start timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; cap numeric;
BEGIN
 IF _estimate IS NULL OR _estimate<=0 OR _estimate>1 THEN RAISE EXCEPTION 'Invalid retry estimate'; END IF;
 PERFORM pg_advisory_xact_lock(8102026);
 SELECT daily_ai_budget_usd INTO STRICT cap FROM public.runtime_limits WHERE singleton AND ai_enabled;
 IF coalesce((SELECT held_and_spent_usd FROM public.ai_budget_days WHERE day=(now() AT TIME ZONE 'UTC')::date),0) +_estimate>cap THEN RAISE EXCEPTION 'Platform AI budget reached'; END IF;
 UPDATE public.operation_reservations SET reserved_usd=reserved_usd+_estimate WHERE id=_id AND user_id=_user AND feature IN ('capture','video','sera','speech') AND created_at>=day_start;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing reservation'; END IF;
END $$;
