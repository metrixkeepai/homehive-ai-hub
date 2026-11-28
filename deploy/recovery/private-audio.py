"""Fetch and verify the protected QA source, then normalize for Chromium."""
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def prepare():
    match = re.fullmatch(r"gs://([a-z0-9][a-z0-9.-]+)/([^\r\n]+)", os.environ["FIXTURE_OBJECT"])
    expected = os.environ["FIXTURE_SHA256"].lower()
    if not match or not re.fullmatch("[0-9a-f]{64}", expected):
        raise ValueError("Invalid fixture reference or SHA-256")
    bucket, name = match.groups()
    base = "https://storage.googleapis.com/storage/v1/b/" + quote(bucket, safe="")
    headers = {"Authorization": "Bearer " + os.environ.pop("FIXTURE_TOKEN")}
    opener = build_opener(NoRedirect())

    def get(url):
        return opener.open(Request(url, headers=headers), timeout=30)

    with get(base + "?fields=iamConfiguration") as response:
        policy = json.load(response)["iamConfiguration"]["publicAccessPrevention"]
        if policy != "enforced":
            raise ValueError("Fixture bucket requires enforced public access prevention")

    private_dir = Path(os.environ["RUNNER_TEMP"]) / "matrixkeep-qa-audio"
    private_dir.mkdir(mode=0o700)
    wav = private_dir / "human.wav"
    digest = hashlib.sha256()
    with tempfile.NamedTemporaryFile(dir=private_dir) as source:
        with get(base + "/o/" + quote(name, safe="") + "?alt=media") as response:
            while chunk := response.read(65536):
                if source.tell() + len(chunk) > 32 * 1024 * 1024:
                    raise ValueError("Fixture exceeds 32 MiB")
                source.write(chunk)
                digest.update(chunk)
        source.flush()
        if digest.hexdigest() != expected:
            raise ValueError("Fixture checksum mismatch")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file",
                        "-f", "mov" if name.lower().endswith(".m4a") else "wav",
                        "-i", source.name, "-map", "0:a:0", "-vn", "-map_metadata", "-1",
                        "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)], check=True)
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        print("wav=" + str(wav), file=output)


if __name__ == "__main__":
    os.umask(0o077)
    prepare()
