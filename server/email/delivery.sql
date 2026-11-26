-- Server-side dispatch ledger. Contains no recipient addresses, email bodies or action tokens.
CREATE SCHEMA IF NOT EXISTS matrixkeep_mail;
CREATE TABLE IF NOT EXISTS matrixkeep_mail.delivery (
  delivery_key text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('claimed', 'sent', 'uncertain')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA matrixkeep_mail FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE matrixkeep_mail.delivery FROM PUBLIC, anon, authenticated;
