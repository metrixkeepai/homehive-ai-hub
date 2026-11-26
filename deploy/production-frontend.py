#!/usr/bin/env python3
"""Prepare MatrixKeep's GCP frontend. Run in authenticated Google Cloud Shell."""
import json
import re
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = "matrixkeep-production"
REGION = "europe-west2"
SERVICE = "matrixkeep-production-web"
PREFIX = "matrixkeep-production"
NEG = PREFIX + "-neg"
BACKEND = PREFIX + "-backend"
ADDRESS = PREFIX + "-ipv4"
CERT = PREFIX + "-cert"
APEX = "matrixkeep.com"
WWW = "www.matrixkeep.com"
PROBE_HOST = "matrixkeep-preflight.invalid"


def gc(*args, check=True, timeout=None):
    return subprocess.run(["gcloud", *args, "--project", PROJECT, "--quiet"],
                          capture_output=True, text=True, check=check, timeout=timeout)


def inspect(kind, name, scope):
    result = gc("compute", kind, "describe", name, scope, "--format=json", check=False)
    if result.returncode == 0:
        return json.loads(result.stdout)
    if "was not found" in result.stderr or "notFound" in result.stderr:
        return None
    raise RuntimeError(result.stderr.strip())


def ensure(kind, name, scope, flags, expected):
    obj = inspect(kind, name, scope)
    if obj is None:
        gc("compute", kind, "create", name, scope, *flags)
        obj = inspect(kind, name, scope)
    if not obj or any(obj.get(key) != val for key, val in expected.items()):
        raise RuntimeError(f"Unexpected configuration on {kind}/{name}; inspect before continuing.")
    return obj


def insert_url_map(name, config):
    # Insert-only: even a concurrent creator cannot have its URL map overwritten.
    token = gc("auth", "print-access-token").stdout.strip()
    request = urllib.request.Request(
        f"https://compute.googleapis.com/compute/v1/projects/{PROJECT}/global/urlMaps",
        data=json.dumps({"name": name, **config}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            operation = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 409:
            return  # The caller describes and verifies the existing map.
        detail = json.loads(error.read()).get("error", {}).get("message", str(error))
        raise RuntimeError(f"Creating URL map {name}: {detail}") from None
    wait_for_global_operation(operation["name"])


def wait_for_global_operation(name):
    deadline = time.monotonic() + 300
    while (remaining := deadline - time.monotonic()) > 0:
        try:
            result = gc("compute", "operations", "describe", name, "--global", "--format=json",
                        timeout=remaining)
        except subprocess.TimeoutExpired:
            break
        operation = json.loads(result.stdout)
        if operation.get("status") == "DONE":
            if "error" in operation or operation.get("httpErrorStatusCode"):
                # Provider messages/details can contain request data. Report only symbolic codes.
                codes = [entry.get("code", "") for entry in operation.get("error", {}).get("errors", [])]
                safe_codes = [code for code in codes if re.fullmatch(r"[A-Z][A-Z0-9_]{0,79}", code)]
                raise RuntimeError("URL-map creation failed: " + (", ".join(safe_codes) or "COMPUTE_ERROR"))
            return
        time.sleep(min(3, max(0, deadline - time.monotonic())))
    raise RuntimeError(f"Timed out waiting for global operation {name} after 300 seconds")


def routing_fields(value):
    if isinstance(value, list):
        return [routing_fields(item) for item in value]
    if isinstance(value, dict):
        return {key: routing_fields(item) for key, item in value.items()
                if not (key in {"stripQuery", "httpsRedirect"} and item is False)}
    return value


def url_map(name, config):
    obj = inspect("url-maps", name, "--global")
    if obj is None:
        insert_url_map(name, config)
        obj = inspect("url-maps", name, "--global")
    if obj is None:
        raise RuntimeError(f"URL map {name} missing after create")
    metadata = {"name", "id", "kind", "creationTimestamp", "selfLink", "fingerprint",
                "description", "tests", "region"}
    actual = {k: v for k, v in obj.items() if k not in metadata}
    if routing_fields(actual) != routing_fields(config):
        raise RuntimeError(f"URL map {name} has different routing; leaving it untouched")
    return obj["selfLink"]


def main():
    project_number = gc("projects", "describe", PROJECT, "--format=value(projectNumber)").stdout.strip()
    if project_number != "517982799169":
        raise RuntimeError("Unexpected project number")
    service_url = gc("run", "services", "describe", SERVICE, "--region", REGION,
                     "--format=value(status.url)").stdout.strip()
    for endpoint in ("live", "ready"):
        probe(service_url + "/health/" + endpoint)
    gc("services", "enable", "compute.googleapis.com")
    neg = ensure("network-endpoint-groups", NEG, "--region=" + REGION,
                 ["--network-endpoint-type=serverless", "--cloud-run-service=" + SERVICE],
                 {"networkEndpointType": "SERVERLESS", "cloudRun": {"service": SERVICE}})
    backend = ensure("backend-services", BACKEND, "--global",
                     ["--load-balancing-scheme=EXTERNAL_MANAGED", "--protocol=HTTP"],
                     {"loadBalancingScheme": "EXTERNAL_MANAGED", "protocol": "HTTP"})
    if not backend.get("backends"):
        gc("compute", "backend-services", "add-backend", BACKEND, "--global",
           "--network-endpoint-group=" + NEG, "--network-endpoint-group-region=" + REGION)
    backend = inspect("backend-services", BACKEND, "--global")
    if [b["group"] for b in backend["backends"]] != [neg["selfLink"]]:
        raise RuntimeError("Unexpected backend group")
    redirect = {"hostRedirect": APEX, "redirectResponseCode": "PERMANENT_REDIRECT",
                "stripQuery": False}
    service = backend["selfLink"]
    https_map = url_map(PREFIX + "-https-map", {
        "defaultService": service,
        "hostRules": [{"hosts": [WWW], "pathMatcher": "canonical"}],
        "pathMatchers": [{"name": "canonical", "defaultUrlRedirect": redirect}],
    })
    # Both public hosts always redirect to HTTPS on port 80. Only two status
    # endpoints on a reserved .invalid host are routed for pre-DNS verification.
    https_redirect = {**redirect, "httpsRedirect": True}
    http_map = url_map(PREFIX + "-http-map", {
        "defaultUrlRedirect": https_redirect,
        "hostRules": [{"hosts": [PROBE_HOST], "pathMatcher": "preflight"}],
        "pathMatchers": [{"name": "preflight", "defaultUrlRedirect": https_redirect,
                          "pathRules": [{"paths": ["/health/live", "/health/ready"], "service": service}]}],
    })
    addr = ensure("addresses", ADDRESS, "--global", ["--ip-version=IPV4", "--network-tier=PREMIUM"],
                  {"addressType": "EXTERNAL", "ipVersion": "IPV4"})
    ip = addr["address"]
    cert = ensure("ssl-certificates", CERT, "--global", ["--domains=" + APEX + "," + WWW],
                  {"type": "MANAGED"})
    if set(cert["managed"]["domains"]) != {APEX, WWW}:
        raise RuntimeError("Unexpected domains on managed certificate")
    for protocol, port, mapping in [("https", "443", https_map), ("http", "80", http_map)]:
        proxy = PREFIX + "-" + protocol + "-proxy"
        rule = PREFIX + "-" + protocol
        extra = ["--ssl-certificates=" + CERT] if protocol == "https" else []
        expected = {"urlMap": mapping}
        if extra:
            expected["sslCertificates"] = [cert["selfLink"]]
        target = ensure("target-" + protocol + "-proxies", proxy, "--global",
                        ["--url-map=" + mapping.split("/")[-1], *extra], expected)
        ensure("forwarding-rules", rule, "--global", ["--address=" + ADDRESS,
               "--target-" + protocol + "-proxy=" + proxy, "--ports=" + port,
               "--network-tier=PREMIUM", "--load-balancing-scheme=EXTERNAL_MANAGED"],
               {"target": target["selfLink"], "IPAddress": ip, "portRange": port + "-" + port,
                "loadBalancingScheme": "EXTERNAL_MANAGED"})
    print(f"IPv4 {ip}; NEG {NEG}; backend {BACKEND}; maps {PREFIX}-https-map / {PREFIX}-http-map")
    print(f"Certificate {CERT}; rules {PREFIX}-https (443), {PREFIX}-http (80)", flush=True)
    for i in range(60):
        try:
            for endpoint in ("live", "ready"):
                probe("http://" + PROBE_HOST + "/health/" + endpoint, "--resolve", PROBE_HOST + ":80:" + ip)
            for host in (APEX, WWW):
                response = subprocess.check_output(["curl", "--noproxy", "*", "-sS", "--max-time", "8",
                    "--resolve", host + ":80:" + ip, "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}",
                    "http://" + host + "/privacy?test=1"], text=True)
                if response != "308 https://" + APEX + "/privacy?test=1":
                    raise ValueError("Unexpected redirect")
            break
        except (subprocess.CalledProcessError, ValueError):
            if i == 59:
                raise RuntimeError("Frontend probes did not pass; leave DNS in place")
            time.sleep(10)
    print("Pre-DNS backend probes: /health/live and /health/ready both HTTP 200 through", ip)
    print("Redirect probes: HTTP apex and www both returned 308 with canonical host, path and query preserved.")
    print("Certificate status:", inspect("ssl-certificates", CERT, "--global")["managed"]["status"])
    print(f"GoDaddy web records: A @ {ip}; A www {ip} (replace the old www CNAME).")
    print("After DNS propagation, require ACTIVE certificate, trusted TLS and matching content on both hosts.")


def probe(url, *extra):
    result = subprocess.check_output(["curl", "--noproxy", "*", "--fail", "--silent", "--max-time", "10",
                                      "--write-out", "\\n%{http_code}",
                                      *extra, url], text=True)
    body, _, status = result.rpartition("\n")
    if status != "200" or json.loads(body) != {"status": "ok"}:
        raise ValueError("Health probe failed")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr or str(error))
