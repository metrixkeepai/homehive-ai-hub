# MatrixKeep Production

Private, isolated production repository for MatrixKeep.

This repository starts a new history. No commits, tags or refs from the original source repository are imported.

Production release status: NOT APPROVED. The application snapshot and hardening work are being prepared. Do not connect production deployments until CI, security, integration and staging release gates pass.

Stack: React, TanStack Start, Nitro, TypeScript, Supabase and Stripe.

Real environment files and secrets must remain outside Git. Use .env.example and environment-specific provider secret stores.
