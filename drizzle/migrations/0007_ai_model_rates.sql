CREATE TABLE public.ai_model_rates (
  model text PRIMARY KEY, input_per_million_usd numeric(10,4) NOT NULL DEFAULT 0, output_per_million_usd numeric(10,4) NOT NULL DEFAULT 0,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_model_rates TO service_role;
ALTER TABLE public.ai_model_rates ENABLE ROW LEVEL SECURITY;