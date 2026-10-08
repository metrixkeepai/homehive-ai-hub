CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, feature text NOT NULL, model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0, latency_ms integer, ok boolean NOT NULL DEFAULT true, error text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.ai_usage_log (created_at);
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.infra_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, category text NOT NULL DEFAULT 'hosting', description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL, currency text NOT NULL DEFAULT 'GBP', period_month date NOT NULL,
  source text NOT NULL DEFAULT 'manual', created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.infra_costs TO service_role;
ALTER TABLE public.infra_costs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false, audiences text[] NOT NULL DEFAULT '{}', rollout integer NOT NULL DEFAULT 100,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL, version integer NOT NULL, name text NOT NULL, audience text NOT NULL,
  monthly numeric(10,2), yearly numeric(10,2), capacity jsonb NOT NULL DEFAULT '{}', benefits text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft', notes text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, version));
GRANT ALL ON public.plan_versions TO service_role;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.provider_connections (
  provider text PRIMARY KEY, status text NOT NULL DEFAULT 'setup_required', notes text,
  last_checked_at timestamptz, last_result text, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.provider_connections TO service_role;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service text NOT NULL, ok boolean NOT NULL,
  latency_ms integer, detail text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.health_checks (created_at);
GRANT ALL ON public.health_checks TO service_role;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;