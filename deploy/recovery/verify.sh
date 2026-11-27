#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "::error::Recovery verification failed at line $LINENO" >&2' ERR
request=deploy/recovery/request.json
sha=$(jq -er '.sha|select(test("^[a-f0-9]{40}$"))' "$request")
run=$(jq -er '.staging_run|select(test("^[0-9]+$"))' "$request")
region=europe-west2
project=matrixkeep-staging
service=matrixkeep-staging-web
registry="$region-docker.pkg.dev/$project/matrixkeep"
args=(--region="$region" --project="$project")
runinfo=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run")
jq -e --arg sha "$sha" '.head_sha==$sha and .head_branch=="main" and .event=="push" and .path==".github/workflows/verify.yml" and .conclusion=="failure"' <<<"$runinfo" >/dev/null
attempt=$(jq -er .run_attempt <<<"$runinfo")
gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/attempts/$attempt/jobs" | jq -e 'any(.jobs[];.name=="verify" and .conclusion=="success") and any(.jobs[];.name=="staging" and .conclusion=="failure" and any(.steps[];.name=="Publish immutable release images" and .conclusion=="success"))' >/dev/null
state=$(gcloud run services describe "$service" "${args[@]}" --format=json)
rev=$(jq -er '[.status.traffic[]|select(.percent>0)]|select(length==1 and .[0].percent==100)|.[0].revisionName' <<<"$state")
[[ $rev == "$(jq -er .revision "$request")" ]]
jq -e --arg rev "$rev" --arg tag "qa-$run-$attempt" '.status.latestReadyRevisionName==$rev and any(.status.traffic[];.tag==$tag and .revisionName==$rev)' <<<"$state" >/dev/null
meta=$(gcloud run revisions describe "$rev" "${args[@]}" --format=json)
jq -e --arg sha "$sha" --arg rev "$rev" '.metadata.name==$rev and .metadata.labels["source-commit"]==$sha and .metadata.labels["serving.knative.dev/service"]=="matrixkeep-staging-web" and .spec.serviceAccountName=="matrixkeep-web@matrixkeep-staging.iam.gserviceaccount.com" and (.spec.containers|length)==1' <<<"$meta" >/dev/null
gcloud auth configure-docker "$region-docker.pkg.dev" --quiet
digest=$(gcloud artifacts docker images describe "$registry/web:$sha" --format='value(image_summary.digest)')
[[ $digest =~ ^sha256:[0-9a-f]{64}$ && $digest == "$(jq -er .digest "$request")" ]]
image="$registry/web@$digest"
# Recover the original submitted index for this exact revision from its deploy log.
# Cloud Run stores the resolved platform manifest in its revision spec.
job_id=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/attempts/$attempt/jobs" | jq -er '.jobs[] | select(.name=="staging") | .id')
gh api "repos/$GITHUB_REPOSITORY/actions/jobs/$job_id/logs" > "$RUNNER_TEMP/original-deploy.log"
jq -Rse --arg sha "$sha" --arg image "$image" --arg rev "$rev" '
  split("\n") | any(.[]; (sub("^[^{]*";"")|fromjson?) | .sha==$sha and .image==$image and .revision==$rev)
' "$RUNNER_TEMP/original-deploy.log" >/dev/null
child=$(jq -er .status.imageDigest <<<"$meta")
declared=$(jq -er '.spec.containers[0].image' <<<"$meta")
[[ $declared == "$child" || $declared == "$image" ]]
docker pull "$image" >/dev/null
[[ $(docker image inspect "$image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}') == "$sha" ]]
if [[ $child != "$image" ]]; then
  docker buildx imagetools inspect "$image" --raw > "$RUNNER_TEMP/index.json"
  selected=$(jq -er '[.manifests[]|select(.platform.os=="linux" and .platform.architecture=="amd64")]|select(length==1)|.[0].digest' "$RUNNER_TEMP/index.json")
  [[ $child == "$registry/web@$selected" ]]
fi
# The staging migration ran in this deployment. Verify its actual execution and image.
job=matrixkeep-staging-migrate
exec_name=$(gcloud run jobs describe "$job" "${args[@]}" --format='value(status.latestCreatedExecution.name)')
execution=$(gcloud run jobs executions describe "$exec_name" "${args[@]}" --format=json)
jq -e 'any(.status.conditions[];.type=="Completed" and .status=="True")' <<<"$execution" >/dev/null
executed=$(jq -er '.spec.template.spec.containers[0].image' <<<"$execution")
md=$(gcloud artifacts docker images describe "$registry/migrator:$sha" --format='value(image_summary.digest)')
[[ $md =~ ^sha256:[a-f0-9]{64}$ ]]
migrator="$registry/migrator@$md"
if [[ $executed != "$migrator" ]]; then
  mig_child=$(docker buildx imagetools inspect "$migrator" --raw | jq -er '[.manifests[]|select(.platform.os=="linux" and .platform.architecture=="amd64")]|select(length==1)|.[0].digest')
  [[ $executed == "$registry/migrator@$mig_child" ]]
fi
docker pull "$migrator" >/dev/null
[[ $(docker image inspect "$migrator" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}') == "$sha" ]]
origin="https://matrixkeep-staging-web-893477687403.europe-west2.run.app"
for path in live ready; do curl -fsS --max-time 25 "$origin/health/$path" | jq -e '.status=="ok"' >/dev/null; done
jq -n --arg sha "$sha" --arg image "$image" --arg digest "$digest" --arg child "$child" --arg migrator "$migrator" --arg execution "$exec_name" --arg project "$project" --arg region "$region" --arg service "$service" --arg revision "$rev" --arg origin "$origin" --arg run "$GITHUB_RUN_ID" --arg source_run "$run" --arg accepted "$(jq -er '.acceptance|select(length>0)' "$request")" '{$sha,$image,$digest,$child,$migrator,$execution,$project,$region,$service,$revision,$origin,recovery_run:$run,staging_run:$source_run,verified_at:(now|todateiso8601),traffic_percent:100,health:{live:200,ready:200},functional_acceptance:$accepted}' > release.json
cat release.json
