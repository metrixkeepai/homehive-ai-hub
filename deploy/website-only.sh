#!/usr/bin/env bash
# Image-only deployment. The runner has no migration URL and never invokes a job.
set -eEuo pipefail
trap 'echo "Website gate failed at line $LINENO" >&2' ERR
pin=25bcf726503b7d8dbbe90a3e82064a9daf5c0297
[[ $WEBSITE_SHA == "$pin" && $REGION == europe-west2 && $PROJECT == "matrixkeep-$TARGET" ]]
[[ -z ${MIGRATOR_IMAGE:-} && -z ${DATABASE_MIGRATION_URL:-} ]]
service="$PROJECT-web"
registry="$REGION-docker.pkg.dev/$PROJECT/matrixkeep/web"
stage_registry="$REGION-docker.pkg.dev/matrixkeep-staging/matrixkeep/web"
case "$TARGET" in
  staging) origin=https://matrixkeep-staging-web-893477687403.europe-west2.run.app; ref=cdfpupivjjamhvmfcvry; stripe=sandbox ;;
  production) origin=https://matrixkeep.com; ref=caqtifaytqukimdkyahv; stripe=live ;;
  *) exit 1 ;;
esac
args=(--region="$REGION" --project="$PROJECT" --quiet)
state() { gcloud run services describe "$service" "${args[@]}" --format=json; }
revision() { gcloud run revisions describe "$1" "${args[@]}" --format=json; }
before=$(state)
previous=$(jq -er '[.status.traffic[]|select(.percent==100)]|if length==1 then .[0].revisionName else error("split traffic") end' <<<"$before")
# A service update inherits its template. Avoid inheriting settings from an unaccepted revision.
if [[ $TARGET == production ]]; then
  jq -e --arg rev "$previous" '.status.latestReadyRevisionName==$rev and .status.latestCreatedRevisionName==$rev' <<<"$before" >/dev/null
fi
runtime_config() {
  jq -e --arg mode "$stripe" --arg ref "$ref" --arg origin "$origin" --arg target "$TARGET" --arg sa "matrixkeep-web@$PROJECT.iam.gserviceaccount.com" '
    .spec.serviceAccountName==$sa and (.spec.containers|length)==1 and
    (.spec.containers[0] | ((.command // [])|length)==0 and ((.args // [])|length)==0 and
    (.env|map({key:.name,value:.value})|from_entries|
      .APP_ENV==$target and .EXPECTED_SUPABASE_REF==$ref and .APP_ORIGIN==$origin and .STRIPE_ENVIRONMENT==$mode
      and (has("DATABASE_MIGRATION_URL")|not)))' >/dev/null
}
revision "$previous" | runtime_config
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
tag="$registry:website-$pin-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
if [[ $TARGET == staging ]]; then
  [[ $(git -C website rev-parse HEAD) == "$pin" ]]
  tag="$registry:website-$pin-46026953960-1"
else
  jq -e --arg sha "$pin" --arg run "$STAGING_RUN" '.sha==$sha and .run==$run and .target=="staging" and .migration=="NONE" and (.digest|test("^sha256:[0-9a-f]{64}$"))' accepted/website.json >/dev/null
  accepted=$(jq -r .digest accepted/website.json)
  docker buildx imagetools create --prefer-index=false --tag "$tag" "$stage_registry@$accepted"
fi
digest=$(gcloud artifacts docker images describe "$tag" --format='value(image_summary.digest)')
[[ $digest =~ ^sha256:[0-9a-f]{64}$ ]]
[[ $digest == sha256:8d2ad848dca1034128caf3e6f929f2932b5f5ae41f89ab19e13cc4c5795d57c3 ]]
if [[ $TARGET == production ]]; then [[ $digest == "$accepted" ]]; fi
image="$registry@$digest"
docker pull "$image" >/dev/null
[[ $(docker image inspect "$image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}') == "$pin" ]]
probe() {
  local base=$1 path
  for path in /health/live /health/ready; do
    curl -fsS --retry 4 --retry-all-errors --max-time 25 "$base$path" | jq -e '.status=="ok"' >/dev/null || return 1
  done
  local cfg
  cfg=$(curl -fsS "$base/matrixkeep-config.js") || return 1
  grep -Fq "https://$ref.supabase.co" <<<"$cfg" && grep -Fq "\"VITE_APP_ORIGIN\":\"$origin\"" <<<"$cfg" || return 1
  python3 - "$base" "$ref" "$cfg" <<'PY'
import sys, json, re, urllib.request
base, ref, cfg = sys.argv[1:]
key = re.search(r'sb_publishable_[\w-]+', cfg).group()
url = 'https://'+ref+'.supabase.co/rest/v1/rpc/published_plan_catalogue'
req = urllib.request.Request(url, data=b'{}', headers={'apikey':key,'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=20) as response: rows=json.load(response)
expected={'free':(0,0),'home':(4.99,49),'plus':(9.99,99),'family':(14.99,149),'business_starter':(19,190),'business':(29,290),'business_pro':(79,790),'business_scale':(149,1490),'enterprise':(None,None),'whitelabel':(None,None)}
assert len(rows)==len(expected) and {r['plan_key']:(r['monthly'],r['yearly']) for r in rows}==expected
PY
}
probe "$origin"
if [[ $TARGET == production ]]; then
  gcloud run services update "$service" "${args[@]}" --image="$image" --no-traffic --tag=website-candidate
fi
new=$(state)
rev=$(jq -er '.status.traffic[]|select(.tag=="website-candidate")|.revisionName' <<<"$new")
url=$(jq -er '.status.traffic[]|select(.tag=="website-candidate")|.url' <<<"$new")
jq -e --arg rev "$previous" 'any(.status.traffic[];.revisionName==$rev and .percent==100)' <<<"$new" >/dev/null
revision "$rev" | runtime_config
verify_image() {
  local accepted=$1 serving=$2 repository digest host path manifest actual
  repository=${accepted%@*}
  digest=${accepted##*@}
  [[ $repository == "$REGION-docker.pkg.dev/$PROJECT/matrixkeep/web" || $repository == "$REGION-docker.pkg.dev/$PROJECT/matrixkeep/migrator" ]] || return 1
  [[ $digest =~ ^sha256:[0-9a-f]{64}$ && ${serving%@*} == "$repository" && ${serving##*@} =~ ^sha256:[0-9a-f]{64}$ ]] || return 1
  if [[ $accepted == "$serving" ]]; then return 0; fi
  # Cloud Run can report the platform manifest selected from a signed-off OCI index.
  # Verify the exact bytes of that index and match its single linux/amd64 child.
  host=${repository%%/*}; path=${repository#*/}
  manifest=$(mktemp)
  curl --proto '=https' --max-time 20 -fsS -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' \
    "https://$host/v2/$path/manifests/$digest" > "$manifest" || { rm -f "$manifest"; return 1; }
  actual="sha256:$(sha256sum "$manifest" | cut -d' ' -f1)"
  if [[ $actual != "$digest" ]]; then rm -f "$manifest"; return 1; fi
  local child
  child=$(jq -er '[.manifests[] | select(.platform.os=="linux" and .platform.architecture=="amd64") | .digest] | select(length==1) | first' "$manifest") || { rm -f "$manifest"; return 1; }
  rm -f "$manifest"
  [[ $serving == "$repository@$child" ]] || return 1
  echo "Verified $repository platform manifest $child in accepted index $digest"
}
if [[ $TARGET == staging ]]; then [[ $rev == matrixkeep-staging-web-00128-gin ]]; fi
v2=$(curl -fsS -H "Authorization: Bearer $(gcloud auth print-access-token)"   "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/services/$service/revisions/$rev")
verify_image "$image" "$(jq -er '.containers[0].image' <<<"$v2")"
probe "$url"
rollback() { gcloud run services update-traffic "$service" "${args[@]}" --to-revisions="$previous=100"; probe "$origin"; }
trap 'trap - ERR; rollback; exit 1' ERR
gcloud run services update-traffic "$service" "${args[@]}" --to-revisions="$rev=100"
state | jq -e --arg rev "$rev" 'any(.status.traffic[];.revisionName==$rev and .percent==100)' >/dev/null
probe "$origin"
jq -n --arg sha "$pin" --arg run "$GITHUB_RUN_ID" --arg target "$TARGET" --arg digest "$digest" --arg revision "$rev" --arg rollback "$previous" '{$sha,$run,$target,$digest,$revision,$rollback,migration:"NONE"}' > website.json
cat website.json
