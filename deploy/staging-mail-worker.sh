#!/usr/bin/env bash
# Source after the staging migration, from deploy/cloud-run.sh.
set -euo pipefail
[[ $APP_ENV == staging && $GCP_PROJECT_ID == matrixkeep-staging && $REGION == europe-west2 ]]
[[ $GITHUB_SHA =~ ^[0-9a-f]{40}$ && $(git rev-parse HEAD) == "$GITHUB_SHA" ]]

# Restrict staging dispatch to the explicit QA mailbox.
[[ ${MATRIXKEEP_MAIL_QA_RECIPIENT:?Set the staging QA mailbox} =~ ^[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]+$ ]]
job=matrixkeep-staging-mail-worker
mail_secrets=()
missing=()
for name in MAIL_DATABASE_URL MATRIXKEEP_SMTP_HOST MATRIXKEEP_SMTP_PORT MATRIXKEEP_SMTP_USER MATRIXKEEP_SMTP_PASSWORD; do
  number=$(enabled_version "$name") || exit 1
  if [[ -z $number ]]; then
    missing+=("$name")
  else
    mail_secrets+=("$name=$name:$number")
  fi
done
if (( ${#missing[@]} )); then
  printf 'NO ENABLED VERSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

repo="$registry/mail-worker"
tag="$repo:$GITHUB_SHA"
docker build -f server/email/Dockerfile --label "org.opencontainers.image.revision=$GITHUB_SHA" -t "$tag" .
docker push "$tag"
digest=$(gcloud artifacts docker images describe "$tag" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
[[ $digest =~ ^sha256:[0-9a-f]{64}$ ]]
mail_identity="matrixkeep-mail@$GCP_PROJECT_ID.iam.gserviceaccount.com"
gcloud run jobs deploy "$job" "${common[@]}" --image="$repo@$digest" \
  --service-account="$mail_identity" --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=15m \
  --set-env-vars="APP_ENV=staging,MATRIXKEEP_MAIL_QA_RECIPIENT=$MATRIXKEEP_MAIL_QA_RECIPIENT" --set-secrets="$(IFS=,; echo "${mail_secrets[*]}")"
gcloud run jobs execute "$job" "${common[@]}" --wait
gcloud run jobs add-iam-policy-binding "$job" "${common[@]}" \
  --member="serviceAccount:$mail_identity" --role=roles/run.invoker
sched=(--location="$REGION" --project="$GCP_PROJECT_ID" --quiet)
existing=$(gcloud scheduler jobs list "${sched[@]}" --filter="name ~ /jobs/$job$" --format='value(name)')
action=create
if [[ -n $existing ]]; then action=update; fi
gcloud scheduler jobs "$action" http "$job" "${sched[@]}" --schedule='*/5 * * * *' --time-zone=Etc/UTC \
  --uri="https://run.googleapis.com/v2/projects/$GCP_PROJECT_ID/locations/$REGION/jobs/$job:run" \
  --http-method=POST --oauth-service-account-email="$mail_identity" --message-body='{}'
printf 'mail_worker=%s digest=%s sha=%s\n' "$job" "$digest" "$GITHUB_SHA"
