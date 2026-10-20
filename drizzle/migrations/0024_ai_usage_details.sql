ALTER TABLE public.ai_usage_log ADD COLUMN workspace_id uuid, ADD COLUMN audio_seconds numeric NOT NULL DEFAULT 0, ADD COLUMN usage_details jsonb NOT NULL DEFAULT '{}';
CREATE INDEX ai_usage_workspace_time ON public.ai_usage_log(user_id,workspace_id,created_at);
