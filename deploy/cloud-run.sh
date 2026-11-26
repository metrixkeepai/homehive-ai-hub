#!/usr/bin/env bash
set -euo pipefail
: "${APP_ENV:?}" "${GCP_PROJECT_ID:?}" "${REGION:?}" "${GITHUB_SHA:?}" "${IMAGE:?}" "${MIGRATOR_IMAGE:?}" "${EXPECTED_SUPABASE_REF:?}"
[[ $APP_ENV == staging || $APP_ENV == production ]]
[[ $GCP_PROJECT_ID == matrixkeep-* && $EXPECTED_SUPABASE_REF =~ ^[a-z]{20}$ ]]
stage_ref=cdfpupivjjamhvmfcvry
service=matrixkeep-$APP_ENV-web
runtime=matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com
migrator=matrixkeep-migrator@$GCP_PROJECT_ID.iam.gserviceaccount.com
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
registry=$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep
[[ ${IMAGE%@*} == "$registry/web" && ${IMAGE#*@} =~ ^sha256:[0-9a-f]{64}$ ]]
[[ ${MIGRATOR_IMAGE%@*} == "$registry/migrator" && ${MIGRATOR_IMAGE#*@} =~ ^sha256:[0-9a-f]{64}$ ]]
if [[ $APP_ENV == staging ]]; then
  [[ $EXPECTED_SUPABASE_REF == "$stage_ref" ]]
  number=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
  [[ $number =~ ^[0-9]+$ ]]
  origin="https://$service-$number.$REGION.run.app"
  stripe=sandbox
else
  [[ $EXPECTED_SUPABASE_REF != "$stage_ref" && $GCP_PROJECT_ID != "${STAGING_PROJECT:?}" ]]
  origin=https://matrixkeep.com
  stripe=disabled
fi

# Pin each secret version to make an existing revision safe to roll back to.
secret_list=$(gcloud secrets list --project="$GCP_PROJECT_ID" --format='value(name)' | sed 's|.*/||')
enabled_version() {
  gcloud secrets versions list "$1" --project="$GCP_PROJECT_ID" --format=json |
    jq -r '[.[] | select((.state | ascii_downcase) == "enabled")
      | (.name | split("/") | last)
      | if test("^[1-9][0-9]*$") then tonumber else error("Invalid secret version ID") end]
      | max // empty'
}
version() {
  local value
  value=$(enabled_version "$1") || return 1
  [[ -n $value ]] || { echo "Missing enabled version of $1" >&2; return 1; }
  echo "$value"
}
has_secret() {
  grep -Fxq "$1" <<< "$secret_list" || return 1
  local value
  value=$(enabled_version "$1") || exit 1
  [[ -n $value ]]
}
binding() { local v; v=$(version "$2") || return 1; echo "$1=$2:$v"; }
bind() { local line; line=$(binding "$1" "${2:-$1}"); secrets+=("$line"); }
subject=$(git log -1 --format=%s)
if [[ $APP_ENV == staging && $subject =~ \[inspect-ms:(matrixkeep-staging-web-[0-9]{5}-[a-z0-9]+)\] ]]; then
  inspected_revision=${BASH_REMATCH[1]}
  [[ $GCP_PROJECT_ID == matrixkeep-staging && $subject == *"[tag-only]"* ]]
  key=MICROSOFT_CONNECTOR_CLIENT_SECRET
  pinned=$(gcloud run revisions describe "$inspected_revision" "${common[@]}" --format=json |
    jq -er --arg key "$key" '.spec.containers[0].env[] | select(.name==$key and .valueFrom.secretKeyRef.name==$key) | .valueFrom.secretKeyRef.key')
  latest=$(version "$key")
  [[ $pinned =~ ^[1-9][0-9]*$ && $latest =~ ^[1-9][0-9]*$ ]]
  echo "Microsoft secret version pinned=$pinned newest_enabled=$latest"
  python3 deploy/staging-ms-diagnostic.py "$inspected_revision" || echo "Outlook diagnostic unavailable"
  ((latest > pinned)) || { echo "No newer enabled version to deploy"; exit 1; }
fi
secrets=()
for key in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY; do bind "$key"; done
bind VITE_SUPABASE_URL SUPABASE_URL
bind VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_PUBLISHABLE_KEY
for key in OPENAI_API_KEY SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD SUPER_ADMIN_RESET_PASSWORD \
  APP_USER_CONNECTION_KEY_SECRET; do
  if [[ $APP_ENV == staging ]] || has_secret "$key"; then bind "$key"; fi
done
for key in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET VITE_PAYMENTS_CLIENT_TOKEN; do bind "$key"; done
if [[ $APP_ENV == production ]]; then
  [[ ${STRIPE_ACCOUNT_ID:-} == acct_1Ug5NgE3qBBc51tM ]] || { echo "Unexpected production merchant" >&2; exit 1; }
fi
payments=false
if [[ $APP_ENV == staging || ${LIVE_BILLING_VERIFIED:-false} == true ]]; then
  payments=true
  if [[ $APP_ENV == production ]]; then
    [[ ${STRIPE_ACCOUNT_ID:-} =~ ^acct_[a-zA-Z0-9]+$ ]] || { echo 'Invalid or missing protected production STRIPE_ACCOUNT_ID' >&2; exit 1; }
    stripe=live
  fi
fi
for provider in GOOGLE MICROSOFT; do
  if [[ $APP_ENV == production ]]; then
    # Production readiness is set per provider in the protected GitHub environment.
    verified_key=${provider}_CONNECTOR_VERIFIED
    [[ ${!verified_key:-false} == true ]] || continue
    version APP_USER_CONNECTION_KEY_SECRET >/dev/null
  fi
  bind "${provider}_CONNECTOR_CLIENT_ID"
  bind "${provider}_CONNECTOR_CLIENT_SECRET"
done
if [[ $APP_ENV == staging ]]; then
  for key in GOOGLE_CONNECTOR_CLIENT_ID GOOGLE_CONNECTOR_CLIENT_SECRET MICROSOFT_CONNECTOR_CLIENT_ID MICROSOFT_CONNECTOR_CLIENT_SECRET APP_USER_CONNECTION_KEY_SECRET; do
    found=false
    for binding_ref in "${secrets[@]}"; do if [[ ${binding_ref%%=*} == "$key" ]]; then found=true; fi; done
    echo "Connector binding $key configured=$found"
  done
fi
secret_flags=$(IFS=,; echo "${secrets[*]}")
env_flags="APP_ENV=$APP_ENV,APP_ORIGIN=$origin,VITE_APP_ORIGIN=$origin,APP_ADDITIONAL_RETURN_ORIGINS=,EXPECTED_SUPABASE_REF=$EXPECTED_SUPABASE_REF,STRIPE_ENVIRONMENT=$stripe,PAYMENTS_ENABLED=$payments"
if [[ $APP_ENV == production ]]; then env_flags+=",STRIPE_ACCOUNT_ID=$STRIPE_ACCOUNT_ID"; fi
db_secret=$(binding DATABASE_MIGRATION_URL DATABASE_MIGRATION_URL)
gcloud run jobs deploy "matrixkeep-$APP_ENV-migrate" "${common[@]}" --service-account="$migrator" \
  --image="$MIGRATOR_IMAGE" --set-secrets="$db_secret" --set-env-vars="APP_ENV=$APP_ENV,EXPECTED_SUPABASE_REF=$EXPECTED_SUPABASE_REF" \
  --max-retries=0 --tasks=1 --execute-now --wait

# Reconcile an owner-rotated staging credential once, before serving the revision.
if [[ $APP_ENV == staging ]]; then
  [[ $GCP_PROJECT_ID == matrixkeep-staging ]]
  admin_bindings=()
  for ref in "${secrets[@]}"; do
    case "$ref" in
      SUPER_ADMIN_PASSWORD=*) password_version=${ref##*:}; admin_bindings+=("$ref");;
      SUPER_ADMIN_EMAIL=*|SUPABASE_URL=*|SUPABASE_SERVICE_ROLE_KEY=*|SUPABASE_PUBLISHABLE_KEY=*) admin_bindings+=("$ref");;
    esac
  done
  admin_secret_flags=$(IFS=,; echo "${admin_bindings[*]}")
  gcloud run jobs deploy matrixkeep-staging-admin-rotation "${common[@]}" --image="$IMAGE" \
    --service-account="$runtime" --command=node --args=server/sync-staging-admin.mjs \
    --set-secrets="$admin_secret_flags" --set-env-vars="APP_ENV=staging,ADMIN_PASSWORD_VERSION=${password_version:?}" \
    --tasks=1 --max-retries=0 --task-timeout=120s --execute-now --wait || {
      # Emit only the predefined diagnostic, never the underlying request or credentials.
      gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="matrixkeep-staging-admin-rotation"' \
        --project="$GCP_PROJECT_ID" --freshness=10m --limit=50 --format='value(textPayload)' | \
        grep -Eo 'Invalid staging admin secret configuration|Staging password contains a line break|Configured admin identity is missing, unconfirmed or banned|Configured identity has no Super Admin role|Configured admin profile unavailable|Stale credential version|Configured credential rejected; confirm the enabled secret version|Staging password rotation failed|Rotated credential failed authentication' | head -1 || true
      exit 1
    }
fi

# On an existing service preserve the previous traffic split until the candidate passes its probes.
existing=$(gcloud run services list "${common[@]}" --filter="metadata.name=$service" --format='value(metadata.name)')
traffic=()
old_split=""
if [[ -n $existing ]]; then
  traffic+=(--no-traffic)
  old_split=$(gcloud run services describe "$service" "${common[@]}" --format=json |
    jq -er '[.status.traffic[] | select(.percent > 0) | "\(.revisionName)=\(.percent)"] | join(",")')
fi
tag="qa-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
deploy_revision() {
  gcloud run deploy "$service" "${common[@]}" --image="$IMAGE" --service-account="$runtime" \
    --set-env-vars="$env_flags,HTTPS_VERIFIED=$1" --set-secrets="$secret_flags" \
    --labels="source-commit=$GITHUB_SHA" --tag="$tag" "${traffic[@]}" --allow-unauthenticated \
    --port=8080 --min="${MIN_INSTANCES:-0}" --max="${MAX_INSTANCES:-3}" --concurrency="${CONCURRENCY:-8}" \
    --cpu="${RUN_CPU:-1}" --memory="${RUN_MEMORY:-1Gi}" --timeout=310s \
    --startup-probe=httpGet.path=/health/live,periodSeconds=5,timeoutSeconds=3,failureThreshold=24 \
    --liveness-probe=httpGet.path=/health/live,periodSeconds=30,timeoutSeconds=4,failureThreshold=3 \
    --readiness-probe=httpGet.path=/health/ready,periodSeconds=10,timeoutSeconds=5,failureThreshold=3
  state=$(gcloud run services describe "$service" "${common[@]}" --format=json)
  revision=$(jq -er --arg tag "$tag" '.status.traffic[]|select(.tag==$tag)|.revisionName' <<< "$state")
  candidate=$(jq -er --arg tag "$tag" '.status.traffic[]|select(.tag==$tag)|.url' <<< "$state")
}
check() {
  local base=$1 path status
  for path in /health/live /health/ready; do
    status=$(curl --proto '=https' -sS --retry 5 --retry-all-errors --fail --max-time 20 \
      -o "$RUNNER_TEMP/health.json" -w '%{http_code}' "$base$path")
    [[ $status == 200 ]] && jq -e '.status == "ok"' "$RUNNER_TEMP/health.json" >/dev/null || return 1
  done
  curl --proto '=https' --fail --silent --show-error "$base/" -o "$RUNNER_TEMP/home.html"
  grep -qi 'MatrixKeep' "$RUNNER_TEMP/home.html"
}
deploy_revision false
check "$candidate"
# A production TLS flag requires the actual mapped customer hostname to be serving this service.
check "$origin"
config=$(curl --proto '=https' -fsS "$origin/matrixkeep-config.js")
grep -Fq "\"VITE_APP_ORIGIN\":\"$origin\"" <<< "$config"
grep -Fq "https://$EXPECTED_SUPABASE_REF.supabase.co" <<< "$config"
if [[ $APP_ENV == staging ]]; then env_flags=${env_flags/APP_ADDITIONAL_RETURN_ORIGINS=,/APP_ADDITIONAL_RETURN_ORIGINS=$candidate,}; fi
if [[ $APP_ENV == staging && $(git log -1 --format=%s) == *"[connector-preview]"* ]]; then
  preview_origin="https://connector-preview---${candidate#*---}"
  env_flags+=",CONNECTOR_PREVIEW_ORIGIN=$preview_origin"
fi
deploy_revision true
check "$candidate"
curl -fsS -D "$RUNNER_TEMP/candidate.headers" "$candidate/health/live" -o /dev/null
grep -Eiq '^strict-transport-security:.*max-age=[1-9]' "$RUNNER_TEMP/candidate.headers"
rollback_traffic() {
  if [[ -n $old_split ]]; then
    gcloud run services update-traffic "$service" "${common[@]}" --to-revisions="$old_split"
  fi
}
if [[ $APP_ENV == staging && $(git log -1 --format=%s) == *"[ai-benchmark]"* ]]; then
  bash deploy/staging-ai-benchmark.sh "$candidate"
fi
if [[ $APP_ENV == staging && $(git log -1 --format=%s) == *"[connector-qa]"* ]]; then
  qa_status=0
  bash deploy/staging-connector-qa.sh "$candidate" || qa_status=$?
  if [[ $(git log -1 --format=%s) == *"[connector-worker]"* ]]; then source deploy/connector-worker.sh; fi
  if ((qa_status)); then exit "$qa_status"; fi
fi
if [[ $APP_ENV == staging && $(git log -1 --format=%s) == *"[tag-only]"* ]]; then
  if [[ -n ${preview_origin:-} ]]; then
    gcloud run services update-traffic "$service" "${common[@]}" --update-tags="connector-preview=$revision"
    state=$(gcloud run services describe "$service" "${common[@]}" --format=json)
    jq -e --arg rev "$revision" --arg url "$preview_origin" '.status.traffic | any(.tag=="connector-preview" and .revisionName==$rev and .url==$url)' <<< "$state" >/dev/null
    gcloud run revisions describe "$revision" "${common[@]}" --format=json |
      jq -r '.spec.containers[0].env[] | select(.name | test("^(GOOGLE_CONNECTOR_CLIENT_(ID|SECRET)|MICROSOFT_CONNECTOR_CLIENT_(ID|SECRET)|APP_USER_CONNECTION_KEY_SECRET)$")) | select(.valueFrom.secretKeyRef.key | test("^[1-9][0-9]*$")) | "Connector binding \(.name)=\(.valueFrom.secretKeyRef.key)"'
    check "$preview_origin"
    for path in privacy terms api/oauth/google/return api/oauth/microsoft/return; do
      status=$(curl --proto '=https' -fsS --max-time 20 -o /dev/null -w '%{http_code}' "$preview_origin/$path")
      [[ $status == 200 ]]
    done
    echo "Verified public pages and OAuth callbacks on $preview_origin"
  fi
  jq -n --arg sha "$GITHUB_SHA" --arg image "$IMAGE" --arg migrator "$MIGRATOR_IMAGE" \
    --arg project "$GCP_PROJECT_ID" --arg region "$REGION" --arg service "$service" --arg origin "$origin" \
    --arg revision "$revision" --arg url "$candidate" \
    '{sha:$sha,image:$image,migrator:$migrator,project:$project,region:$region,service:$service,origin:$origin,revision:$revision,candidate_url:$url,public_traffic_switched:false}' > release.json
  echo "Tagged staging revision $revision verified. Public traffic retained."
  exit 0
fi
trap rollback_traffic ERR
gcloud run services update-traffic "$service" "${common[@]}" --to-revisions="$revision=100"
check "$origin"
curl -fsS -D "$RUNNER_TEMP/public.headers" "$origin/health/live" -o /dev/null
grep -Eiq '^strict-transport-security:.*max-age=[1-9]' "$RUNNER_TEMP/public.headers"
trap - ERR
jq -n --arg sha "$GITHUB_SHA" --arg image "$IMAGE" --arg migrator "$MIGRATOR_IMAGE" \
  --arg project "$GCP_PROJECT_ID" --arg region "$REGION" --arg service "$service" --arg revision "$revision" \
  --arg origin "$origin" '{sha:$sha,image:$image,migrator:$migrator,project:$project,region:$region,service:$service,revision:$revision,origin:$origin}' > release.json

# Run owner-requested certification against the same pinned release.
if [[ $APP_ENV == staging && $(git log -1 --format=%s) == *"[staging-qa]"* ]]; then
  bash deploy/staging-qa.sh
fi
