#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
image="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/ai-benchmark:$GITHUB_SHA"
docker build --target ai-benchmark -t "$image" .
docker push "$image"
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
job=matrixkeep-staging-ai-benchmark
gcloud run jobs deploy "$job" "${common[@]}" --image="$image" \
  --service-account="matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars="APP_ENV=staging,QA_CANDIDATE=$1" \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY:latest" \
  --cpu=1 --memory=1Gi --tasks=1 --max-retries=0 --task-timeout=28m
execution=$(gcloud run jobs execute "$job" "${common[@]}" --format='value(metadata.name)' --async)
status=1
for ((i=0;i<175;i++)); do
  state=$(gcloud run jobs executions describe "$execution" "${common[@]}" --format=json | jq -r '[.status.conditions[]? | select(.type=="Completed")][0].status // "Unknown"')
  if [[ $state == True ]]; then status=0; break; fi
  if [[ $state == False ]]; then break; fi
  sleep 10
done
gcloud logging read "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"$job\" AND labels.\"run.googleapis.com/execution_name\"=\"$execution\"" \
  --project="$GCP_PROJECT_ID" --limit=100 --order=asc --format=json | jq -c '.[] | if .jsonPayload.label then .jsonPayload else (.textPayload // "" | fromjson? | select(.label)) end'
exit "$status"
