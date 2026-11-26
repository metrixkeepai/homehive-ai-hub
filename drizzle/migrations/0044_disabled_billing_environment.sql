ALTER TABLE public.runtime_limits
  DROP CONSTRAINT runtime_limits_billing_environment_check,
  ADD CONSTRAINT runtime_limits_billing_environment_check
    CHECK (billing_environment IN ('disabled', 'sandbox', 'live'));
