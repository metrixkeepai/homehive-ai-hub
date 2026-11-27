#!/usr/bin/env bash
set -euo pipefail
target=$1; mode=$2
[[ $target == staging || $target == production ]]
[[ $mode == required || $mode == pending-activation || $mode == activate ]]
project=matrixkeep-$target
args=(--project="$project" --region=europe-west2 --quiet)
service=$project-web
revision=$(gcloud run services describe "$service" "${args[@]}" --format=json | jq -er '[.status.traffic[]|select(.percent==100)]|select(length==1)|.[0].revisionName')
meta=$(gcloud run revisions describe "$revision" "${args[@]}" --format=json)
sa=$(jq -er '.spec.serviceAccountName' <<<"$meta")
[[ $sa == "matrixkeep-web@$project.iam.gserviceaccount.com" ]]
if [[ $mode == activate ]]; then
 [[ $target == production ]]
 jq -e --arg sha "${RELEASE_SHA:?}" '.metadata.labels["source-commit"]==$sha' <<<"$meta" >/dev/null
fi
bindings=()
for key in OPENAI_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
 version=$(jq -er --arg key "$key" '.spec.containers[0].env[]|select(.name==$key and .valueFrom.secretKeyRef.name==$key)|.valueFrom.secretKeyRef.key' <<<"$meta")
 [[ $version =~ ^[1-9][0-9]*$ && $(gcloud secrets versions describe "$version" --secret="$key" --project="$project" --format='value(state)') == ENABLED ]]
 bindings+=("$key=$key:$version")
done
code=$(cat deploy/recovery/ai-check.mjs)
image=$(jq -er .status.imageDigest <<<"$meta")
gcloud run jobs deploy "$project-ai-parity" "${args[@]}" --service-account="$sa" --image="$image" --command=node --args="^@@^--input-type=module@@-e@@$code" --set-env-vars="APP_ENV=$target,CHECK_MODE=$mode" --set-secrets="$(IFS=,; echo "${bindings[*]}")" --tasks=1 --max-retries=0 --task-timeout=2m --execute-now --wait
