"""Report allowlisted Outlook exchange diagnostics from one staging revision."""
import json
import re
import subprocess
import sys

revision = sys.argv[1]
if not re.fullmatch(r"matrixkeep-staging-web-\d{5}-[a-z0-9]+", revision):
    sys.exit("Invalid staging revision")
query = (f'resource.type="cloud_run_revision" AND resource.labels.revision_name="{revision}" '
         'AND logName="projects/matrixkeep-staging/logs/run.googleapis.com%2Fstderr"')
result = subprocess.run(["gcloud", "logging", "read", query, "--project=matrixkeep-staging",
                         "--freshness=7d", "--limit=5000", "--format=json"],
                        capture_output=True, text=True)
if result.returncode:
    sys.exit("Log read denied" if "PERMISSION_DENIED" in result.stderr else "Log read failed")
entries = sorted(json.loads(result.stdout), key=lambda e: (e["timestamp"], e.get("insertId", "")))
groups = {}
events = []
for entry in entries:
    payload = entry.get("jsonPayload", {})
    if payload.get("event") == "microsoft_token_failure":
        events.append((entry["timestamp"], payload))
    instance = entry.get("labels", {}).get("instanceId")
    if instance:
        groups.setdefault(instance, []).append((entry["timestamp"], entry.get("textPayload", "")))
for lines in groups.values():
    for i, (stamp, line) in enumerate(lines):
        if "microsoft_token_failure" not in line:
            continue
        block = "\n".join(value for _, value in lines[i:i+10]).split("}", 1)[0]
        if block.count("microsoft_token_failure") != 1:
            continue
        payload = {}
        for field in ("provider", "grantType", "status", "oauth", "classification"):
            match = re.search(r"\b" + field + r"""['"]?\s*:\s*['"]?([a-z0-9_]+)""", block)
            if match:
                payload[field] = match[1]
        codes = re.search(r"""\bcodes['"]?\s*:\s*\[([\d,\s]*)\]""", block)
        payload["codes"] = [int(n) for n in re.findall(r"\d+", codes[1])] if codes else []
        events.append((stamp, payload))
events = [e for e in events if e[1].get("provider") == "outlook"
          and e[1].get("grantType") == "authorization_code"]
if not events:
    sys.exit("No attributable Outlook authorization-code diagnostic in log window")
p = max(events, key=lambda e: e[0])[1]
oauth = set("invalid_client invalid_grant invalid_scope unauthorized_client invalid_request interaction_required temporarily_unavailable server_error unknown".split())
classes = oauth | set("network invalid_client_secret expired_client_secret application_not_found redirect_mismatch pkce_mismatch expired_grant code_redeemed".split())
print("OUTLOOK_DIAGNOSTIC", json.dumps({
    "status": int(p["status"]) if re.fullmatch(r"[1-5]\d\d", str(p.get("status"))) else None,
    "oauth": p.get("oauth") if p.get("oauth") in oauth else None,
    "codes": [v for v in (p.get("codes") or []) if type(v) is int and 0 < v < 100000000][:4],
    "classification": p.get("classification") if p.get("classification") in classes else None
}))
