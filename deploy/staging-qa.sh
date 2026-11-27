#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
image="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/staging-qa:$GITHUB_SHA"
target=staging-qa
entry=()
if [[ $(git log -1 --format=%s) == *"[capture-qa]"* ]]; then
  target=ai-benchmark
  entry=(--command=node --args=scripts/staging-capture-parity.mjs)
fi
docker build --target "$target" -t "$image" .
docker push "$image"
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
revision=$(jq -er .revision release.json)
metadata=$(gcloud run revisions describe "$revision" "${common[@]}" --format=json)
for key in SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD STRIPE_WEBHOOK_SECRET; do
  bound=$(jq -er --arg key "$key" '.spec.containers[0].env[] | select(.name == $key and .valueFrom.secretKeyRef.name == $key) | .valueFrom.secretKeyRef.key' <<< "$metadata")
  latest=$(gcloud secrets versions list "$key" --project="$GCP_PROJECT_ID" --format=json | jq -er '[.[] | select((.state | ascii_downcase) == "enabled") | (.name | split("/") | last | tonumber)] | max')
  [[ $bound == "$latest" ]] || { echo "$key binding is stale"; exit 1; }
  echo "$revision uses $key version $bound"
done
jq -c '{sha,image,revision}' release.json
bindings=$(jq -er '[.spec.containers[0].env[] | select(.name | IN("SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_PUBLISHABLE_KEY","SUPER_ADMIN_EMAIL","SUPER_ADMIN_PASSWORD","STRIPE_SECRET_KEY","OPENAI_API_KEY")) | "\(.name)=\(.valueFrom.secretKeyRef.name):\(.valueFrom.secretKeyRef.key)"]|if length==7 then join(",") else error("Missing QA binding") end' <<< "$metadata")
# Metrics can lag traffic by several minutes. Read them after the browser checks,
# including when certification fails, without changing the QA job exit status.
trap 'status=$?; python3 deploy/staging-performance.py || true; exit "$status"' EXIT
gcloud run jobs deploy matrixkeep-staging-certification "${common[@]}" --image="$image" \
 --service-account="matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com" --set-secrets="$bindings" \
 "${entry[@]}" --set-env-vars="APP_ENV=staging,QA_RUN=$GITHUB_RUN_ID,QA_ATTEMPT=${GITHUB_RUN_ATTEMPT:?},QA_REVISION=$revision,QA_REPEAT_HOME_PLUS=true" --cpu=2 --memory=2Gi --max-retries=0 --task-timeout=24m --tasks=1 --execute-now --wait
