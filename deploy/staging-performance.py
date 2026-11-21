"""Report Cloud Monitoring samples for this staging revision only."""
import datetime as dt
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request

with open("release.json", encoding="utf-8") as source:
    release = json.load(source)
project = release["project"]
if (project, release["service"], os.environ["APP_ENV"]) != (
    "matrixkeep-staging", "matrixkeep-staging-web", "staging"
):
    raise RuntimeError("Unexpected staging metrics target")

revision = release["revision"]
end = dt.datetime.now(dt.timezone.utc)
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
for metric in ("container/cpu/utilizations", "container/memory/utilizations",
               "container/startup_latencies", "request_latency/pending"):
    query = {
        "filter": f'metric.type="run.googleapis.com/{metric}" AND resource.type="cloud_run_revision" AND resource.labels.revision_name="{revision}"',
        "interval.startTime": (end - dt.timedelta(minutes=30)).isoformat(),
        "interval.endTime": end.isoformat(),
        "aggregation.alignmentPeriod": "1800s",
        "aggregation.perSeriesAligner": "ALIGN_PERCENTILE_95",
    }
    url = f"https://monitoring.googleapis.com/v3/projects/{project}/timeSeries?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "x-goog-user-project": project})
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.load(response)
        samples = [point["value"]["doubleValue"] for series in data.get("timeSeries", [])
                   for point in series.get("points", []) if "doubleValue" in point["value"]]
        print(json.dumps({"revision": revision, "metric": metric, "aligned_p95": samples}))
    except urllib.error.HTTPError as error:
        print(json.dumps({"revision": revision, "metric": metric, "http_error": error.code}))
