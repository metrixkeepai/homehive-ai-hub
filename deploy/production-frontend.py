#!/usr/bin/env python3
"""Prepare MatrixKeep's GCP frontend. Run in authenticated Google Cloud Shell."""
import json
import pathlib
import subprocess
import tempfile
import time

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


def gc(*args, check=True):
    return subprocess.run(["gcloud", *args, "--project", PROJECT, "--quiet"],
                          capture_output=True, text=True, check=check)


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


def url_map(name, config):
    obj = inspect("url-maps", name, "--global")
    if obj is None:
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp) / "map.yaml"
            path.write_text(json.dumps({"name": name, **config}))
            gc("compute", "url-maps", "validate", "--global", "--load-balancing-scheme=EXTERNAL_MANAGED",
               "--source", str(path))
            gc("compute", "url-maps", "import", name, "--global", "--source", str(path))
        obj = inspect("url-maps", name, "--global")
    # The API may return canonicalized representations. Fail closed on route drift.
    if any(obj.get(key) != val for key, val in config.items()):
        raise RuntimeError(f"Verify existing URL map {name}: its routes differ from the expected configuration.")
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
    for protocol, port, mapping in [("http", "80", http_map), ("https", "443", https_map)]:
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
    print("Backend health and HTTP canonical redirects passed through the global IP.")
    print("Certificate status:", inspect("ssl-certificates", CERT, "--global")["managed"]["status"])
    print(f"GoDaddy web records: A @ {ip}; A www {ip} (replace the old www CNAME).")
    print("After DNS propagation, require ACTIVE certificate, trusted TLS and matching content on both hosts.")


def probe(url, *extra):
    result = subprocess.check_output(["curl", "--noproxy", "*", "--fail", "--silent", "--max-time", "10",
                                      *extra, url], text=True)
    if json.loads(result) != {"status": "ok"}:
        raise ValueError("Health probe failed")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr or str(error))
