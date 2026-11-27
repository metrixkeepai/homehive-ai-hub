#!/usr/bin/env bash
set -euo pipefail
[[ $GCP_PROJECT_ID == matrixkeep-production && $REGION == europe-west2 && $EXPECTED_SUPABASE_REF == caqtifaytqukimdkyahv ]]
manifest="$RUNNER_TEMP/staging/mail-release.json"
jq -e --arg sha "$GITHUB_SHA" '.sha==$sha' "$manifest" >/dev/null
host="$REGION-docker.pkg.dev"
registry="$host/$GCP_PROJECT_ID/matrixkeep"
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
gcloud auth configure-docker "$host" --quiet
declare -A images
for name in migrator mail-worker; do
  field=$name
  if [[ $name == mail-worker ]]; then field=worker; fi
  source=$(jq -er --arg field "$field" '.[$field]' "$manifest")
  digest=${source##*@}
  [[ ${source%@*} == "$host/matrixkeep-staging/matrixkeep/$name" && $digest =~ ^sha256:[0-9a-f]{64}$ ]]
  dest="$registry/$name"
  docker buildx imagetools create --prefer-index=false --tag "$dest:$GITHUB_SHA" "$source"
  actual=$(gcloud artifacts docker images describe "$dest:$GITHUB_SHA" --format='value(image_summary.digest)')
  [[ $actual == "$digest" ]]
  images[$name]="$dest@$digest"
done
version() {
  gcloud secrets versions list "$1" --project="$GCP_PROJECT_ID" --filter='state=ENABLED' --format='value(name)' |
    awk -F/ '{print $NF}' | sort -nr | sed -n '1p'
}
db_version=$(version DATABASE_MIGRATION_URL)
[[ $db_version =~ ^[1-9][0-9]*$ ]]
gcloud run jobs deploy matrixkeep-production-mail-migrate "${common[@]}" --image="${images[migrator]}" \
  --service-account="matrixkeep-migrator@$GCP_PROJECT_ID.iam.gserviceaccount.com" --tasks=1 --max-retries=0 \
  --set-secrets="DATABASE_MIGRATION_URL=DATABASE_MIGRATION_URL:$db_version" \
  --set-env-vars="APP_ENV=production,EXPECTED_SUPABASE_REF=$EXPECTED_SUPABASE_REF" --execute-now --wait
job=matrixkeep-production-mail-worker
identity="matrixkeep-mail@$GCP_PROJECT_ID.iam.gserviceaccount.com"
bindings=()
for key in MAIL_DATABASE_URL MATRIXKEEP_SMTP_HOST MATRIXKEEP_SMTP_PORT MATRIXKEEP_SMTP_USER MATRIXKEEP_SMTP_PASSWORD; do
  number=$(version "$key") || { echo "::error::Cannot list versions for $key"; continue; }
  if [[ $number =~ ^[1-9][0-9]*$ ]]; then bindings+=("$key=$key:$number"); else echo "::error::No enabled version for $key"; fi
done
[[ ${#bindings[@]} == 5 ]]
gcloud run jobs deploy "$job" "${common[@]}" --image="${images[mail-worker]}" --service-account="$identity" \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=15m --set-secrets="$(IFS=,; echo "${bindings[*]}")" \
  --set-env-vars='APP_ENV=production,MATRIXKEEP_MAIL_QA_RECIPIENT=zaineluvathingal@gmail.com' --execute-now --wait
# Both passes use the normal renderer, SMTP submission and persistent delivery ledger.
for pass in first replay; do
  gcloud run jobs execute "$job" "${common[@]}" --update-env-vars=MATRIXKEEP_PRODUCTION_DELIVERY_QA=true --wait
done
gcloud run jobs add-iam-policy-binding "$job" "${common[@]}" --member="serviceAccount:$identity" --role=roles/run.invoker
sched=(--location="$REGION" --project="$GCP_PROJECT_ID" --quiet)
if result=$(gcloud scheduler jobs describe "$job" "${sched[@]}" --format='value(state)' 2>&1); then action=update
elif [[ $result == *NOT_FOUND:* ]]; then action=create
else printf '%s\n' "$result" >&2; exit 1; fi
target="https://run.googleapis.com/v2/projects/$GCP_PROJECT_ID/locations/$REGION/jobs/$job:run"
gcloud scheduler jobs "$action" http "$job" "${sched[@]}" --schedule='*/5 * * * *' --time-zone=Etc/UTC \
  --uri="$target" --http-method=POST --oauth-service-account-email="$identity" --message-body='{}'
gcloud scheduler jobs describe "$job" "${sched[@]}" --format=json |
  jq -e --arg target "$target" --arg identity "$identity" '.state=="ENABLED" and .httpTarget.uri==$target and .httpTarget.oauthToken.serviceAccountEmail==$identity'
