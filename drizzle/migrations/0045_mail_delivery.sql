-- Server-side dispatch ledger. Contains no recipient addresses, email bodies or action tokens.
CREATE SCHEMA IF NOT EXISTS matrixkeep_mail;
CREATE TABLE IF NOT EXISTS matrixkeep_mail.delivery (
  delivery_key text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('claimed', 'sent', 'uncertain')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA matrixkeep_mail FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE matrixkeep_mail.delivery FROM PUBLIC, anon, authenticated;

-- Queue event references only. Delivery resolves the recipient from the confirmed
-- account at dispatch time. Existing users and redemptions are never backfilled.
CREATE TABLE IF NOT EXISTS matrixkeep_mail.pending (
  kind text NOT NULL CHECK (kind IN ('welcome','voucher')),
  source_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind,source_id)
);
REVOKE ALL ON matrixkeep_mail.pending FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION matrixkeep_mail.on_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO matrixkeep_mail.pending(kind,source_id,user_id)
  VALUES ('welcome',NEW.id,NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION matrixkeep_mail.on_redemption() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO matrixkeep_mail.pending(kind,source_id,user_id)
  VALUES ('voucher',NEW.id,NEW.user_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION matrixkeep_mail.on_confirmation(), matrixkeep_mail.on_redemption() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER matrixkeep_mail_on_confirmation
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION matrixkeep_mail.on_confirmation();
CREATE OR REPLACE TRIGGER matrixkeep_mail_on_redemption
AFTER INSERT ON public.voucher_redemptions FOR EACH ROW
EXECUTE FUNCTION matrixkeep_mail.on_redemption();

-- The worker only sees fields needed for currently pending deliveries.
CREATE OR REPLACE VIEW matrixkeep_mail.messages AS
SELECT p.kind, p.source_id, u.email, u.raw_user_meta_data->>'first_name' AS first_name,
       CASE WHEN v.id IS NOT NULL THEN '••••' || right(v.code,least(4,greatest(length(v.code)-1,0))) END AS voucher_code_masked,
       replace(v.benefit_type,'_',' ') AS voucher_benefit,
       to_char(v.benefit_ends_at AT TIME ZONE 'UTC','DD Mon YYYY') AS voucher_expiry
FROM matrixkeep_mail.pending p JOIN auth.users u ON u.id=p.user_id
LEFT JOIN public.voucher_redemptions v ON p.kind='voucher' AND v.id=p.source_id AND v.user_id=p.user_id
WHERE u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL;
REVOKE ALL ON matrixkeep_mail.messages FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='matrixkeep_mail_sender') THEN
    CREATE ROLE matrixkeep_mail_sender NOLOGIN;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA matrixkeep_mail TO matrixkeep_mail_sender;
GRANT SELECT ON matrixkeep_mail.messages TO matrixkeep_mail_sender;
GRANT INSERT (delivery_key,state), SELECT (delivery_key,state), UPDATE (state)
  ON matrixkeep_mail.delivery TO matrixkeep_mail_sender;
GRANT SELECT(kind,source_id), DELETE ON matrixkeep_mail.pending TO matrixkeep_mail_sender;
-- Each preference is an explicit user action. Extracted document fields or existing
-- calendar alarms cannot opt in a user. Removing the record removes the preference.
INSERT INTO public.feature_flags(key,name,enabled) VALUES ('record_email_reminders','Record email reminders',false) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS matrixkeep_mail.reminder_preferences (
  record_id uuid PRIMARY KEY REFERENCES public.home_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
REVOKE ALL ON matrixkeep_mail.reminder_preferences FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_email_reminder(_record uuid,_enabled boolean DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE account uuid := auth.uid();
BEGIN
  IF account IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.home_items i WHERE i.id=_record AND i.user_id=account
    AND i.section IN ('warranties','insurance','documents','maintenance')
    AND public.can_access_workspace(i.workspace_id)
  ) THEN RAISE insufficient_privilege; END IF;
  IF _enabled IS DISTINCT FROM FALSE AND NOT public.feature_enabled(account,'record_email_reminders') THEN
    IF _enabled IS TRUE THEN RAISE insufficient_privilege; END IF;
    RETURN NULL;
  END IF;
  IF _enabled IS TRUE THEN
    INSERT INTO matrixkeep_mail.reminder_preferences(record_id,user_id)
    VALUES(_record,account) ON CONFLICT DO NOTHING;
  ELSIF _enabled IS FALSE THEN
    DELETE FROM matrixkeep_mail.reminder_preferences WHERE record_id=_record AND user_id=account;
  END IF;
  RETURN EXISTS(SELECT 1 FROM matrixkeep_mail.reminder_preferences WHERE record_id=_record AND user_id=account);
END;
$$;
REVOKE ALL ON FUNCTION public.record_email_reminder(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_email_reminder(uuid,boolean) TO authenticated;

CREATE OR REPLACE VIEW matrixkeep_mail.due_reminders AS
WITH records AS (
  SELECT i.id,i.title,i.section,u.email,u.raw_user_meta_data->>'first_name' AS first_name,
         coalesce(f.fields,'{}'::jsonb) AS fields
  FROM matrixkeep_mail.reminder_preferences p
  JOIN public.home_items i ON i.id=p.record_id AND i.user_id=p.user_id
  JOIN auth.users u ON u.id=p.user_id AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
  JOIN public.profiles a ON a.id=p.user_id AND NOT a.suspended
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(lower(btrim(e->>0)),btrim(e->>1)) AS fields
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.fields)='array' THEN i.fields ELSE '[]' END) e
    WHERE jsonb_typeof(e)='array' AND e->>0 IS NOT NULL
  ) f ON true
  WHERE public.feature_enabled(p.user_id,'record_email_reminders') AND (i.workspace_id IS NULL OR EXISTS
    (SELECT 1 FROM public.workspaces w WHERE w.id=i.workspace_id AND w.owner_id=p.user_id))
), dated AS (
  SELECT r.*, CASE r.section
    WHEN 'warranties' THEN fields->>'expiry date'
    WHEN 'insurance' THEN fields->>'renewal date'
    WHEN 'documents' THEN fields->>'expiry date'
    WHEN 'maintenance' THEN fields->>'due date' END AS due
  FROM records r WHERE lower(coalesce(fields->>'status','')) NOT IN ('archived','done','completed','cancelled')
)
SELECT CASE section WHEN 'warranties' THEN 'warranty' WHEN 'documents' THEN 'document'
                    WHEN 'insurance' THEN 'insurance' WHEN 'maintenance' THEN 'maintenance' END AS kind,
       id AS source_id, due, email, first_name, title,
       coalesce(nullif(fields->>'asset',''),nullif(fields->>'product / asset',''),title) AS asset_name,
       coalesce(fields->>'provider',fields->>'insurer') AS provider_name,
       fields->>'property' AS property_name, fields->>'covered item' AS covered_item,
       fields->>'related to' AS related_asset, fields->>'room' AS property_or_room
FROM dated
-- Compare with the actual seven days and today, avoiding casts of malformed user input.
WHERE due IN (SELECT to_char((now() AT TIME ZONE 'UTC')::date + offset_days,'YYYY-MM-DD')
              FROM generate_series(0,7) AS offset_days);
REVOKE ALL ON matrixkeep_mail.due_reminders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON matrixkeep_mail.due_reminders TO matrixkeep_mail_sender;
GRANT EXECUTE ON FUNCTION public.feature_enabled(uuid,text) TO matrixkeep_mail_sender;
