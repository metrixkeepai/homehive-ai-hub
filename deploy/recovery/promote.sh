#!/usr/bin/env bash
set -euo pipefail
manifest=accepted/release.json
export RELEASE_SHA=$(jq -er .sha "$manifest")
[[ $GCP_PROJECT_ID == matrixkeep-production && $REGION == europe-west2 ]]
[[ $(git -C application rev-parse HEAD) == "$RELEASE_SHA" ]]
[[ $(jq -r .recovery_run "$manifest") == "${RECOVERY_RUN:?}" ]]
# A protected staging identity has reread the live service for this specific dispatch.
jq -e --arg run "$GITHUB_RUN_ID" --arg recovery "$RECOVERY_RUN" --slurpfile expected "$manifest" '
  . as $w | .promotion_run==$run and .original_recovery==$recovery and
  (now-(.verified_at|fromdateiso8601) | .>=0 and .<300) and
  .traffic_percent==100 and .health=={live:200,ready:200} and
  all(["sha","image","revision","child","digest","migrator","project","region","service"][]; $w[.]==$expected[0][.])
' witness/witness.json >/dev/null
bash deploy/recovery/guard.sh production pending-activation
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
for pair in web:image migrator:migrator; do
 name=${pair%:*}
 src=$(jq -er --arg field "${pair#*:}" '.[$field]' "$manifest")
 digest=${src##*@}
 [[ ${src%@*} == "$REGION-docker.pkg.dev/matrixkeep-staging/matrixkeep/$name" && $digest =~ ^sha256:[a-f0-9]{64}$ ]]
 dest="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/matrixkeep/$name"
 docker buildx imagetools create --prefer-index=false --tag "$dest:$RELEASE_SHA" "$src"
 [[ $(gcloud artifacts docker images describe "$dest:$RELEASE_SHA" --format='value(image_summary.digest)') == "$digest" ]]
 if [[ $name == web ]]; then export IMAGE="$dest@$digest"; else export MIGRATOR_IMAGE="$dest@$digest"; fi
done
(cd application && GITHUB_SHA="$RELEASE_SHA" bash deploy/cloud-run.sh)
bash deploy/recovery/guard.sh production activate
bash deploy/recovery/guard.sh production required
