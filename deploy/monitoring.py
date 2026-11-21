"""Reconcile MatrixKeep uptime and alert policies in the current release project."""
import json
import os
import subprocess
import urllib.parse
import urllib.request

release = json.load(open("release.json", encoding="utf-8"))
project, service = release["project"], release["service"]
if project != os.environ["GCP_PROJECT_ID"] or service != "matrixkeep-" + os.environ["APP_ENV"] + "-web":
    raise ValueError("Unexpected monitoring target")
base = "https://monitoring.googleapis.com/v3/"
parent = "projects/" + project
token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()

def request(method, path, data=None):
    req = urllib.request.Request(base + path, method=method, headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json",
        "x-goog-user-project": project,
    }, data=None if data is None else json.dumps(data).encode())
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

def reconcile(collection, config, fields):
    path = parent + "/" + collection
    query = ""
    while True:
        page = request("GET", path + query)
        for old in page.get(collection, []):
            if old["displayName"] == config["displayName"]:
                if collection == "uptimeCheckConfigs" and any(
                    old.get(key) != config[key] for key in ("period", "monitoredResource")
                ):
                    raise ValueError("Existing readiness monitor has a different target or period")
                return request("PATCH", old["name"] + "?updateMask=" + ",".join(fields),
                               {"name": old["name"], **{key: config[key] for key in fields}})
        if not page.get("nextPageToken"):
            break
        query = "?" + urllib.parse.urlencode({"pageToken": page["nextPageToken"]})
    return request("POST", path, config)

host = urllib.parse.urlsplit(release["origin"]).hostname
check = {"displayName": service + " readiness", "monitoredResource": {
    "type": "uptime_url", "labels": {"project_id": project, "host": host}},
    "httpCheck": {"useSsl": True, "validateSsl": True, "path": "/health/ready", "port": 443,
                  "acceptedResponseStatusCodes": [{"statusValue": 200}]},
    "period": "300s", "timeout": "10s"}
uptime = reconcile("uptimeCheckConfigs", check, ["httpCheck", "timeout"])
check_id = uptime["name"].split("/")[-1]
resource = f'resource.type="cloud_run_revision" AND resource.label.service_name="{service}"'
channel = os.environ.get("MONITORING_CHANNEL", "")
if channel and not channel.startswith(parent + "/notificationChannels/"):
    raise ValueError("Notification channel must belong to the MatrixKeep project")

def alert(name, selector, aligner, threshold, duration, comparison="COMPARISON_GT", reduce=None):
    agg = {"alignmentPeriod": "300s", "perSeriesAligner": aligner}
    if reduce:
        agg["crossSeriesReducer"] = reduce
    condition = {"displayName": name, "conditionThreshold": {
        "filter": selector, "aggregations": [agg], "comparison": comparison,
        "thresholdValue": threshold, "duration": duration, "trigger": {"count": 1}}}
    config = {"displayName": service + " " + name, "combiner": "OR", "conditions": [condition],
              "enabled": True}
    if channel:
        config["notificationChannels"] = [channel]
    reconcile("alertPolicies", config, list(config))
    print("Monitoring configured:", name)

alert("readiness unavailable", f'resource.type="uptime_url" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.label.check_id="{check_id}"',
      "ALIGN_FRACTION_TRUE", 0.5, "300s", "COMPARISON_LT", "REDUCE_MEAN")
def metric(name):
    return resource + ' AND metric.type="run.googleapis.com/' + name + '"'

alert("elevated 5xx", metric("request_count") + ' AND metric.label.response_code_class="5xx"',
      "ALIGN_DELTA", 4, "0s", reduce="REDUCE_SUM")
alert("p95 latency above 5 seconds", metric("request_latencies"), "ALIGN_PERCENTILE_95", 5000, "600s")
alert("high CPU", metric("container/cpu/utilizations"), "ALIGN_PERCENTILE_95", 0.9, "900s")
alert("high memory", metric("container/memory/utilizations"), "ALIGN_PERCENTILE_95", 0.9, "600s")
alert("instance limit sustained", metric("container/instance_count"), "ALIGN_MAX",
      int(os.environ.get("MAX_INSTANCES", "3")) - 0.5, "900s", reduce="REDUCE_SUM")
# Crash signatures come from Cloud Run's platform log, not user request payloads.
crashes = {"displayName": service + " repeated container exits", "combiner": "OR", "enabled": True,
           "conditions": [{"displayName": "abnormal container exit", "conditionMatchedLog": {"filter":
               f'resource.type="cloud_run_revision" AND resource.labels.service_name="{service}" '
               'AND log_id("run.googleapis.com/varlog/system") AND severity>=ERROR '
               'AND (textPayload:"Container called exit" OR textPayload:"LIVENESS" OR textPayload:"Memory limit")'}}],
           "alertStrategy": {"notificationRateLimit": {"period": "300s"}, "autoClose": "1800s"}}
if channel:
    crashes["notificationChannels"] = [channel]
    reconcile("alertPolicies", crashes, list(crashes))
