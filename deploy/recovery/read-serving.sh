#!/usr/bin/env bash
set -euo pipefail
project=matrixkeep-production
region=europe-west2
args=(--project="$project" --region="$region")
traffic=$(gcloud run services describe matrixkeep-production-web "${args[@]}" --format=json)
revision=$(jq -er '[.status.traffic[] | select(.percent>0)] | select(length==1 and .[0].percent==100) | .[0].revisionName' <<<"$traffic")
meta=$(gcloud run revisions describe "$revision" "${args[@]}" --format=json)
sha=$(jq -er '.metadata.labels["source-commit"]' <<<"$meta")
echo "Serving revision=$revision source=$sha traffic=100%"
[[ $revision == "$(jq -r .production_revision deploy/recovery/owner-acceptance.json)" ]]
[[ $sha == "$(jq -r .source_sha deploy/recovery/owner-acceptance.json)" ]]
job=matrixkeep-production-mail-worker
gcloud scheduler jobs describe "$job" --project="$project" --location="$region" --format=json |
  jq -e --arg job "$job" '.state=="ENABLED" and (.httpTarget.uri|endswith("/jobs/"+$job+":run"))' >/dev/null
# A new scheduled execution may already be running. Inspect the most recent completed one.
gcloud run jobs executions list --job="$job" "${args[@]}" --limit=8 --format=json |
  jq -ec '[.[]|select(.status.completionTime)]|sort_by(.status.completionTime)|last |
    select((now-(.status.completionTime|sub("\\.[0-9]+Z$";"Z")|fromdateiso8601))<1200) |
    select(any(.status.conditions[];.type=="Completed" and .status=="True")) |
    {mail_worker:.metadata.name,completed:.status.completionTime,scheduler:"ENABLED"}'
