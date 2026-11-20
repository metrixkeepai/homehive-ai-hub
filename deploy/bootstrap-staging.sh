#!/usr/bin/env bash
# Run under the owner's Google identity in Cloud Shell.
# Inputs are project and billing identifiers only. No application credentials.
set -euo pipefail
project=${1:-matrixkeep-staging}
region=${REGION:-europe-west2}
[[ $project =~ ^matrixkeep-staging(-[a-z0-9-]+)?$ ]] || { echo "Expected a dedicated MatrixKeep staging project ID"; exit 2; }
if ! gcloud projects describe "$project" --format='value(projectId)' >/dev/null 2>&1; then
  gcloud projects create "$project" --name="MatrixKeep staging"
fi
if [[ $(gcloud billing projects describe "$project" --format='value(billingEnabled)') != True ]]; then
  billing=${2:-}
  if [[ -z $billing ]]; then
    mapfile -t accounts < <(gcloud billing accounts list --filter='open=true' --format='value(name)')
    if (( ${#accounts[@]} == 1 )); then billing=${accounts[0]##*/}; else
      echo "Supply the intended billing account ID as argument 2." >&2; exit 1
    fi
  fi
  gcloud billing projects link "$project" --billing-account="$billing"
fi
gcloud services enable --project="$project" run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com monitoring.googleapis.com logging.googleapis.com cloudresourcemanager.googleapis.com
number=$(gcloud projects describe "$project" --format='value(projectNumber)')
if ! gcloud artifacts repositories describe matrixkeep --project="$project" --location="$region" >/dev/null 2>&1; then
  gcloud artifacts repositories create matrixkeep --repository-format=docker --project="$project" --location="$region"
fi
for name in matrixkeep-deployer matrixkeep-web matrixkeep-migrator; do
  email="$name@$project.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$email" --project="$project" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$name" --project="$project" --display-name="$name"
  fi
done
deploy="matrixkeep-deployer@$project.iam.gserviceaccount.com"
web="matrixkeep-web@$project.iam.gserviceaccount.com"
migration="matrixkeep-migrator@$project.iam.gserviceaccount.com"
for role in run.admin secretmanager.viewer browser monitoring.uptimeCheckConfigEditor monitoring.alertPolicyEditor logging.configWriter serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$deploy" --role="roles/$role" --condition=None --quiet >/dev/null
done
gcloud artifacts repositories add-iam-policy-binding matrixkeep --project="$project" --location="$region" \
  --member="serviceAccount:$deploy" --role=roles/artifactregistry.writer --quiet >/dev/null
for sa in "$web" "$migration"; do
  gcloud iam service-accounts add-iam-policy-binding "$sa" --project="$project" \
    --member="serviceAccount:$deploy" --role=roles/iam.serviceAccountUser --quiet >/dev/null
done
for secret in DATABASE_MIGRATION_URL SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY \
  OPENAI_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET VITE_PAYMENTS_CLIENT_TOKEN SUPER_ADMIN_EMAIL \
  SUPER_ADMIN_PASSWORD SUPER_ADMIN_RESET_PASSWORD LOVABLE_API_KEY APP_USER_CONNECTION_KEY_SECRET \
  GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY; do
  if ! gcloud secrets describe "$secret" --project="$project" >/dev/null 2>&1; then
    gcloud secrets create "$secret" --project="$project" --replication-policy=automatic
  fi
  principal=$web
  if [[ $secret == DATABASE_MIGRATION_URL ]]; then principal=$migration; fi
  gcloud secrets add-iam-policy-binding "$secret" --project="$project" --role=roles/secretmanager.secretAccessor \
    --member="serviceAccount:$principal" --quiet >/dev/null
done
if [[ -z $(gcloud secrets versions list SUPER_ADMIN_RESET_PASSWORD --project="$project" --filter='state=ENABLED' --limit=1 --format='value(name)') ]]; then
  printf false | gcloud secrets versions add SUPER_ADMIN_RESET_PASSWORD --project="$project" --data-file=-
fi
pool=matrixkeep-github
provider=staging
if ! gcloud iam workload-identity-pools describe "$pool" --project="$project" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool" --project="$project" --location=global --display-name="MatrixKeep GitHub"
fi
trust="assertion.repository_owner_id=='340979120' && assertion.repository_id=='1414320559' && assertion.ref in ['refs/heads/main','refs/heads/release/matrixkeep-cloud-run'] && assertion.environment=='staging' && assertion.workflow_ref=='metrixkeepai/homehive-ai-hub/.github/workflows/verify.yml@'+assertion.ref"
if ! gcloud iam workload-identity-pools providers describe "$provider" --workload-identity-pool="$pool" \
  --location=global --project="$project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$provider" --project="$project" --location=global \
    --workload-identity-pool="$pool" --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' --attribute-condition="$trust"
fi
gcloud iam service-accounts add-iam-policy-binding "$deploy" --project="$project" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$number/locations/global/workloadIdentityPools/$pool/attribute.repository_id/1414320559" --quiet >/dev/null
echo "GitHub staging environment variables"
echo "GCP_PROJECT_ID=$project"
echo "GCP_DEPLOY_SERVICE_ACCOUNT=$deploy"
echo "GCP_REGION=$region"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$number/locations/global/workloadIdentityPools/$pool/providers/$provider"

# When Cloud Shell already has the owner's GitHub CLI session, finish the GitHub side too.
repo=metrixkeepai/homehive-ai-hub
if command -v gh >/dev/null && [[ $(gh api user --jq .login 2>/dev/null || true) == metrixkeepai ]]; then
  if ! gh api "repos/$repo/environments/staging" --silent 2>/dev/null; then
    gh api -X PUT "repos/$repo/environments/staging" --silent
  fi
  gh variable set GCP_PROJECT_ID --repo "$repo" --env staging --body "$project"
  gh variable set GCP_REGION --repo "$repo" --env staging --body "$region"
  gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo "$repo" --env staging --body "$deploy"
  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$repo" --env staging \
    --body "projects/$number/locations/global/workloadIdentityPools/$pool/providers/$provider"
fi
