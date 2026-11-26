#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == production && $GCP_PROJECT_ID == matrixkeep-production && $REGION == europe-west2 ]]
[[ ${LIVE_BILLING_VERIFIED:-false} == false && $STRIPE_ACCOUNT_ID == acct_1Ug5NgE3qBBc51tM ]]
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
revision=$(jq -er '.revision' release.json)
# Request the Compute-independent Cloud Run v2 schema explicitly. gcloud's
# revision describe output may use Knative or v2 field names.
run_api="https://run.googleapis.com/v2/projects/$GCP_PROJECT_ID/locations/$REGION"
read_run_resource() {
  curl --fail --silent --show-error --max-time 20 \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" "$run_api/$1"
}
service=matrixkeep-production-web
state=$(read_run_resource "services/$service/revisions/$revision")
if ! jq -e --arg image "$IMAGE" '.containers[0].image == $image' <<<"$state" >/dev/null; then
  echo "Serving container image differs from the accepted image" >&2
  jq -r '.containers[0].image' <<<"$state" >&2
  exit 1
fi
jq -e '.containers[0].env | any(.[]; .name=="STRIPE_ENVIRONMENT" and .value=="disabled") and any(.[]; .name=="PAYMENTS_ENABLED" and .value=="false")' <<<"$state" >/dev/null || { echo "Serving billing switches are inconsistent" >&2; exit 1; }
secret_version() {
  jq -er --arg key "$1" '.[] | select(.name==$key) | .valueSource.secretKeyRef |
    select((.secret | split("/") | last)==$key) | .version | tostring | select(test("^[1-9][0-9]*$"))'
}
for name in VITE_PAYMENTS_CLIENT_TOKEN STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  version=$(jq '.containers[0].env' <<<"$state" | secret_version "$name") || { echo "Expected numeric secret binding: $name" >&2; exit 1; }
  echo "$name version $version"
  if [[ $name == STRIPE_SECRET_KEY ]]; then server_version=$version; fi
done
job=$(read_run_resource "jobs/matrixkeep-production-migrate")
jq -e --arg image "$MIGRATOR_IMAGE" '.template.template.containers[0].image==$image' <<<"$job" >/dev/null || { echo "Migrator image differs from accepted image" >&2; exit 1; }
migration_secret=$(jq '.template.template.containers[0].env' <<<"$job" | secret_version DATABASE_MIGRATION_URL)
gcloud run jobs deploy matrixkeep-production-billing-reconciliation "${common[@]}" \
  --image="$MIGRATOR_IMAGE" --service-account="matrixkeep-migrator@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --command=node --args=scripts/billing-reconciliation-acceptance.mjs \
  --set-secrets="DATABASE_MIGRATION_URL=DATABASE_MIGRATION_URL:$migration_secret" \
  --set-env-vars="APP_ENV=production,EXPECTED_SUPABASE_REF=$EXPECTED_SUPABASE_REF" \
  --max-retries=0 --tasks=1 --task-timeout=120s --execute-now --wait
probe="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
gcloud run jobs deploy matrixkeep-production-billing-acceptance "${common[@]}" \
  --image="$IMAGE" --service-account="matrixkeep-web@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --command=node --args=server/billing-acceptance.mjs --set-secrets="STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:$server_version" \
  --set-env-vars="APP_ENV=production,STRIPE_ENVIRONMENT=disabled,STRIPE_ACCOUNT_ID=$STRIPE_ACCOUNT_ID,ACCEPTANCE_RUN=$probe" \
  --max-retries=0 --tasks=1 --task-timeout=180s --execute-now --wait || {
    # Only emit operation, HTTP status and permission label from this job.
    gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="matrixkeep-production-billing-acceptance"' \
      --project="$GCP_PROJECT_ID" --freshness=5m --limit=40 --format='value(textPayload)' |
      grep -Eo '(GET|POST) /v1/[a-zA-Z0-9/_-]+ HTTP [0-9]{3}( required permission: [A-Za-z ]+)?' | head -1 || true
    exit 1
  }
# Prove the public endpoint rejects unsigned input before waiting for Stripe's actual delivery.
status=$(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  --data '{}' https://matrixkeep.com/api/public/payments/webhook)
[[ $status == 400 ]]
for i in {1..30}; do
  filter="resource.type=\"cloud_run_revision\" AND resource.labels.revision_name=\"$revision\" AND jsonPayload.event=\"billing_acceptance_webhook\" AND jsonPayload.probe=\"$probe\""
  received=$(gcloud logging read "$filter" --project="$GCP_PROJECT_ID" --freshness=20m --limit=1 --format='value(jsonPayload.session)')
  if [[ $received =~ ^cs_live_[a-zA-Z0-9]+$ ]]; then
    echo "Verified Stripe-signed expired Checkout delivery for run $probe"
    exit 0
  fi
  sleep 10
done
echo 'No verified provider delivery for this run. Check checkout.session.expired on the existing live destination.' >&2
exit 1
