"""Request the approved production QA alias change via the public user Auth API."""
import getpass
import json
import subprocess
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PROJECT = "matrixkeep-production"
AUTH = "https://caqtifaytqukimdkyahv.supabase.co/auth/v1"
OLD = "zaineluvathingal+matrixkeep-invite@gmail.com"
NEW = "zaineluvathingal+matrixkeep-change@gmail.com"


def main():
    key = subprocess.check_output(
        ["gcloud", "secrets", "versions", "access", "latest",
         "--project=" + PROJECT, "--secret=SUPABASE_PUBLISHABLE_KEY"], text=True
    ).strip()
    def call(method, path, data, token=None):
        headers = {"apikey": key, "Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = Request(AUTH + path, data=json.dumps(data).encode(), headers=headers, method=method)
        try:
            with urlopen(request, timeout=20) as response:
                return json.load(response)
        except HTTPError as error:
            raise SystemExit(f"Production Auth rejected {method} {path.split('?')[0]} (HTTP {error.code}).")
    session = call("POST", "/token?grant_type=password", {
        "email": OLD, "password": getpass.getpass(f"MatrixKeep password for {OLD}: ")
    })
    if session["user"]["email"].lower() != OLD:
        raise SystemExit("Unexpected QA identity")
    call("PUT", "/user?redirect_to=https%3A%2F%2Fmatrixkeep.com%2Fapp",
         {"email": NEW}, session["access_token"])
    print("Change requested. Open the confirmations addressed to the two aliases in Gmail.")


if __name__ == "__main__":
    main()
