#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
image="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/staging-qa:$GITHUB_SHA"
docker build --target staging-qa -t "$image" .
docker push "$image"
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
bindings=$(gcloud run services describe matrixkeep-staging-web "${common[@]}" --format=json |
  jq -er '[.spec.template.spec.containers[0].env[] | select(.name | IN("SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_PUBLISHABLE_KEY","SUPER_ADMIN_EMAIL","SUPER_ADMIN_PASSWORD","STRIPE_SECRET_KEY","OPENAI_API_KEY")) | "\(.name)=\(.valueFrom.secretKeyRef.name):\(.valueFrom.secretKeyRef.key)"]|if length==7 then join(",") else error("Missing QA binding") end')
gcloud run jobs deploy matrixkeep-staging-certification "${common[@]}" --image="$image" \
 --service-account="matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com" --set-secrets="$bindings" \
 --set-env-vars="APP_ENV=staging,QA_RUN=$GITHUB_RUN_ID" --cpu=2 --memory=2Gi --max-retries=0 --task-timeout=12m --tasks=1 --execute-now --wait
