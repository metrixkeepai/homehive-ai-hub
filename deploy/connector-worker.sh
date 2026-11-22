#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
job=matrixkeep-staging-connector-worker
image="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/connector-worker:$GITHUB_SHA"
docker build --target connector-worker -t "$image" .
docker push "$image"
worker_secrets=()
for binding in "${secrets[@]}"; do
 case "${binding%%=*}" in LOVABLE_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|APP_USER_CONNECTION_KEY_SECRET|*APP_USER_CONNECTOR_CLIENT_API_KEY|MICROSOFT_CONNECTOR_CLIENT_*) worker_secrets+=("$binding");; esac
done
gcloud run jobs deploy "$job" "${common[@]}" --service-account="$runtime" --image="$image" --tasks=1 --max-retries=0 --task-timeout=20m --cpu=1 --memory=1Gi --set-env-vars="APP_ENV=staging" --set-secrets="$(IFS=,; echo "${worker_secrets[*]}")"
gcloud run jobs add-iam-policy-binding "$job" "${common[@]}" --member="serviceAccount:$runtime" --role=roles/run.invoker
sched=(--location="$REGION" --project="$GCP_PROJECT_ID" --quiet)
gcloud services enable cloudscheduler.googleapis.com --project="$GCP_PROJECT_ID" --quiet
verb=create
if gcloud scheduler jobs describe "$job" "${sched[@]}" >/dev/null 2>&1; then verb=update; fi
gcloud scheduler jobs "$verb" http "$job" "${sched[@]}" --schedule='0 9 1,15 * *' --time-zone=Europe/London --uri="https://run.googleapis.com/v2/projects/$GCP_PROJECT_ID/locations/$REGION/jobs/$job:run" --http-method=POST --oauth-service-account-email="$runtime" --message-body='{}'
