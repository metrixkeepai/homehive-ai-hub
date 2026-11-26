#!/usr/bin/env bash
set -euo pipefail
[[ $APP_ENV == production && $GCP_PROJECT_ID == matrixkeep-production && $REGION == europe-west2 ]]
[[ ${LIVE_BILLING_VERIFIED:-false} == false && $STRIPE_ACCOUNT_ID == acct_1Ug5NgE3qBBc51tM ]]
common=(--project="$GCP_PROJECT_ID" --region="$REGION" --quiet)
revision=$(jq -er '.revision' release.json)
state=$(gcloud run revisions describe "$revision" "${common[@]}" --format=json)
jq -e --arg image "$IMAGE" '.spec.containers[0] | .image==$image and any(.env[]; .name=="STRIPE_ENVIRONMENT" and .value=="disabled") and any(.env[]; .name=="PAYMENTS_ENABLED" and .value=="false")' <<<"$state" >/dev/null
for name in VITE_PAYMENTS_CLIENT_TOKEN STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  version=$(jq -er --arg name "$name" '.spec.containers[0].env[] | select(.name==$name and .valueFrom.secretKeyRef.name==$name) | .valueFrom.secretKeyRef.key | select(test("^[1-9][0-9]*$"))' <<<"$state")
  echo "$name version $version"
  if [[ $name == STRIPE_SECRET_KEY ]]; then server_version=$version; fi
done
migration_secret=$(gcloud run jobs describe matrixkeep-production-migrate "${common[@]}" --format=json |
  jq -er '.. | objects | select(.name?=="DATABASE_MIGRATION_URL" and .valueFrom.secretKeyRef.name?=="DATABASE_MIGRATION_URL") | .valueFrom.secretKeyRef.key | select(test("^[1-9][0-9]*$"))')
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
  --max-retries=0 --tasks=1 --task-timeout=180s --execute-now --wait
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
