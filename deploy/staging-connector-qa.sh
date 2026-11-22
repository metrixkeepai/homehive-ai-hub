#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
image="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/connector-qa:$GITHUB_SHA"
docker build --target staging-qa -t "$image" .
docker push "$image"
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
job=matrixkeep-staging-connector-qa
gcloud run jobs deploy "$job" "${common[@]}" --image="$image" \
  --command=node --args=scripts/staging-connector-qa.mjs --service-account="matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars="APP_ENV=staging,QA_CANDIDATE=$1,QA_SHA=$GITHUB_SHA" \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY:latest,SUPER_ADMIN_EMAIL=SUPER_ADMIN_EMAIL:latest,SUPER_ADMIN_PASSWORD=SUPER_ADMIN_PASSWORD:latest" \
  --cpu=1 --memory=1Gi --tasks=1 --max-retries=0 --task-timeout=28m
execution=$(gcloud run jobs execute "$job" "${common[@]}" --format='value(metadata.name)' --async)
status=1
for ((i=0;i<175;i++)); do
  state=$(gcloud run jobs executions describe "$execution" "${common[@]}" --format=json | jq -r '[.status.conditions[]? | select(.type=="Completed")][0].status // "Unknown"')
  if [[ $state == True ]]; then status=0; break; fi
  if [[ $state == False ]]; then break; fi
  sleep 10
done
echo "Benchmark execution $execution completed with status $status"
if [[ $status != 0 ]]; then
 gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=$job AND labels.\"run.googleapis.com/execution_name\"=\"$execution\"" --project="$GCP_PROJECT_ID" --limit=60 --format='value(textPayload)' | grep -E 'Error:|TimeoutError|strict mode violation|^QA:' | cut -c1-360 || true
fi
exit "$status"
