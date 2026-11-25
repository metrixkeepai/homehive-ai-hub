#!/usr/bin/env bash
# One-time production bootstrap. Run serially in the owner's GCP Cloud Shell.
set +x
set -euo pipefail
project=matrixkeep-production
number=517982799169
region=europe-west2
pool=matrixkeep-prod-github
provider=github-production
repo=metrixkeepai/homehive-ai-hub
ref=caqtifaytqukimdkyahv
gc() { gcloud --quiet --project="$project" "$@"; }
[[ $(gc projects describe "$project" --format='value(projectNumber)') == "$number" ]]
[[ $(gc billing projects describe "$project" --format='value(billingEnabled)') == True ]]
gc services enable artifactregistry.googleapis.com run.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com secretmanager.googleapis.com cloudresourcemanager.googleapis.com monitoring.googleapis.com logging.googleapis.com
if ! gc artifacts repositories describe matrixkeep --location="$region" >/dev/null 2>&1; then
  gc artifacts repositories create matrixkeep --location="$region" --repository-format=docker
fi
[[ $(gc artifacts repositories describe matrixkeep --location="$region" --format='value(format)') == DOCKER ]]
for name in matrixkeep-web matrixkeep-migrator matrixkeep-deployer; do
  email="$name@$project.iam.gserviceaccount.com"
  if ! gc iam service-accounts describe "$email" >/dev/null 2>&1; then
    gc iam service-accounts create "$name" --display-name="$name"
  fi
  gc iam service-accounts describe "$email" --format=json | jq -e '.disabled != true' >/dev/null
done
deployer="matrixkeep-deployer@$project.iam.gserviceaccount.com"
web="matrixkeep-web@$project.iam.gserviceaccount.com"
migrator="matrixkeep-migrator@$project.iam.gserviceaccount.com"
wif=(--location=global --workload-identity-pool="$pool")
if ! gc iam workload-identity-pools describe "$pool" --location=global >/dev/null 2>&1; then
  gc iam workload-identity-pools create "$pool" --location=global --display-name="MatrixKeep production GitHub"
fi
# The principal binding is pool-scoped. Reject unexpected sibling providers.
siblings=$(gc iam workload-identity-pools providers list "${wif[@]}" --format=json)
jq -e --arg p "/providers/$provider" 'all(.[]; .name | endswith($p))' <<<"$siblings" >/dev/null
workflow="$repo/.github/workflows/promote.yml@refs/heads/main"
sub="repo:$repo:environment:production"
trust="assertion.repository_id=='1414320559' && assertion.repository_owner_id=='340979120' && assertion.repository=='$repo' && assertion.ref=='refs/heads/main' && assertion.environment=='production' && assertion.sub=='$sub' && assertion.workflow_ref=='$workflow' && assertion.event_name=='workflow_dispatch'"
if ! gc iam workload-identity-pools providers describe "$provider" "${wif[@]}" >/dev/null 2>&1; then
  gc iam workload-identity-pools providers create-oidc "$provider" "${wif[@]}" --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping='google.subject=assertion.sub' --attribute-condition="$trust"
fi
metadata=$(gc iam workload-identity-pools providers describe "$provider" "${wif[@]}" --format=json)
jq -e --arg trust "$trust" '.state=="ACTIVE" and .disabled!=true and .oidc.issuerUri=="https://token.actions.githubusercontent.com" and (.oidc.allowedAudiences // [] | length)==0 and .attributeMapping["google.subject"]=="assertion.sub" and .attributeCondition==$trust' <<<"$metadata" >/dev/null
gc iam service-accounts add-iam-policy-binding "$deployer" --role=roles/iam.workloadIdentityUser --member="principal://iam.googleapis.com/projects/$number/locations/global/workloadIdentityPools/$pool/subject/$sub" >/dev/null
for role in run.admin secretmanager.viewer serviceusage.serviceUsageConsumer monitoring.uptimeCheckConfigEditor monitoring.alertPolicyEditor; do
  gc projects add-iam-policy-binding "$project" --member="serviceAccount:$deployer" --role="roles/$role" --condition=None >/dev/null
done
for account in "$web" "$migrator"; do
  gc iam service-accounts add-iam-policy-binding "$account" --role=roles/iam.serviceAccountUser --member="serviceAccount:$deployer" >/dev/null
done
gc artifacts repositories add-iam-policy-binding matrixkeep --location="$region" --role=roles/artifactregistry.writer --member="serviceAccount:$deployer" >/dev/null
# Only registry manifest reads cross the staging/production boundary.
gcloud --quiet --project=matrixkeep-staging artifacts repositories add-iam-policy-binding matrixkeep --location="$region" --role=roles/artifactregistry.reader --member="serviceAccount:$deployer" >/dev/null
for key in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_MIGRATION_URL OPENAI_API_KEY SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD SUPER_ADMIN_RESET_PASSWORD APP_USER_CONNECTION_KEY_SECRET; do
  if ! gc secrets describe "$key" >/dev/null 2>&1; then
    gc secrets create "$key" --replication-policy=automatic
  fi
  principal=$web
  if [[ $key == DATABASE_MIGRATION_URL ]]; then principal=$migrator; fi
  gc secrets add-iam-policy-binding "$key" --role=roles/secretmanager.secretAccessor --member="serviceAccount:$principal" >/dev/null
  # Never rotate an existing secret, including one with disabled versions.
  versions=$(gc secrets versions list "$key" --format=json)
  if [[ $(jq length <<<"$versions") == 0 ]]; then
    case "$key" in
      SUPABASE_URL|APP_USER_CONNECTION_KEY_SECRET|SUPER_ADMIN_PASSWORD|SUPER_ADMIN_RESET_PASSWORD) ;;
      *) continue ;;
    esac
    case "$key" in
      SUPABASE_URL) printf '%s' "https://$ref.supabase.co" ;;
      APP_USER_CONNECTION_KEY_SECRET|SUPER_ADMIN_PASSWORD) openssl rand -base64 32 | tr -d '\n' ;;
      SUPER_ADMIN_RESET_PASSWORD) printf false ;;
    esac | gc secrets versions add "$key" --data-file=- >/dev/null
  fi
done
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=$(jq -r .name <<<"$metadata")"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=$deployer"
