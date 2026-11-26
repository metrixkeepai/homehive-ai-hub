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
