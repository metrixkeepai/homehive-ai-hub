"""Provision only missing production mail resources from an administrator's Cloud Shell."""
import base64
import getpass
import hashlib
import hmac
import os
import re
import secrets
import shutil
import smtplib
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

PROJECT = "matrixkeep-production"
REF = "caqtifaytqukimdkyahv"
LOGIN = "matrixkeep_mail_worker"
IDENTITY = f"matrixkeep-mail@{PROJECT}.iam.gserviceaccount.com"
DEPLOYER = f"serviceAccount:matrixkeep-deployer@{PROJECT}.iam.gserviceaccount.com"
PASSWORD = "MATRIXKEEP_SMTP_PASSWORD"
DB = "MAIL_DATABASE_URL"
PUBLIC = {"MATRIXKEEP_SMTP_HOST": "smtppro.zoho.uk", "MATRIXKEEP_SMTP_PORT": "465",
          "MATRIXKEEP_SMTP_USER": "hello@matrixkeep.com"}


def gcloud(*args, data=None, optional=False):
    result = subprocess.run(["gcloud", *args, "--project", PROJECT, "--quiet"],
                            input=data, capture_output=True)
    if result.returncode:
        error = result.stderr.decode(errors="replace")
        if optional and ("NOT_FOUND" in error or "not found" in error.lower()):
            return None
        # Never print provider output on a command which might handle credentials.
        raise SystemExit("GCP command failed: " + " ".join(args[:3]) +
                         " (" + next(iter(re.findall(r'\b(?:PERMISSION_DENIED|NOT_FOUND|ALREADY_EXISTS|FAILED_PRECONDITION)\b', error)), "see Cloud Audit Logs") + ")")
    return result.stdout.decode().strip()


def enabled(name):
    versions = gcloud("secrets", "versions", "list", name, "--filter=state=ENABLED", "--format=value(name)")
    return max((int(v.rsplit("/", 1)[-1]) for v in versions.splitlines()), default=0)


def create_secret(name):
    if gcloud("secrets", "describe", name, "--format=value(name)", optional=True) is None:
        gcloud("secrets", "create", name, "--replication-policy=automatic")


def add(name, value):
    gcloud("secrets", "versions", "add", name, "--data-file=-", data=value.encode())


def db_env(uri, ca, worker=False):
    u = urlsplit(uri)
    direct = u.hostname == f"db.{REF}.supabase.co"
    pool = bool(re.fullmatch(r"[a-z0-9-]+\.pooler\.supabase\.com", u.hostname or ""))
    expected = LOGIN if worker else "postgres"
    if not (u.scheme in ("postgresql", "postgres") and u.path in ("", "/", "/postgres") and
            u.port in (None, 5432) and u.password and
            ((direct and u.username == expected) or (pool and u.username == f"{expected}.{REF}"))):
        raise SystemExit("The supplied database binding is not the expected production login and project.")
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    env.update(PGHOST=u.hostname, PGPORT="5432", PGDATABASE="postgres",
               PGUSER=u.username, PGPASSWORD=unquote(u.password), PGSSLMODE="verify-full",
               PGSSLROOTCERT=str(ca), PGCONNECT_TIMEOUT="12")
    return env


def sql(env, statement):
    p = subprocess.run(["psql", "-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1"],
                       input=statement, text=True, env=env, capture_output=True)
    if p.returncode:
        raise SystemExit("Production PostgreSQL operation failed. Verify the production Session Pooler and login in Supabase Connect.")
    return p.stdout.strip()


def scram(password):
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 4096)
    client_key = hmac.digest(salted, b"Client Key", "sha256")
    b64 = lambda data: base64.b64encode(data).decode()
    return ("SCRAM-SHA-256$4096:" + b64(salt) + "$" + b64(hashlib.sha256(client_key).digest()) +
            ":" + b64(hmac.digest(salted, b"Server Key", "sha256")))


def database_secret(ca):
    version = enabled(DB)
    if version:
        uri = gcloud("secrets", "versions", "access", str(version), "--secret=" + DB)
    else:
        migration_version = enabled("DATABASE_MIGRATION_URL")
        if not migration_version:
            raise SystemExit("Production DATABASE_MIGRATION_URL has no enabled version.")
        migration = gcloud("secrets", "versions", "access", str(migration_version), "--secret=DATABASE_MIGRATION_URL")
        admin = db_env(migration, ca)
        check = """SELECT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
          AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit AND
          (SELECT array_agg(r.rolname::text ORDER BY r.rolname)=ARRAY['matrixkeep_mail_sender']
            FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member=w.oid)
          FROM pg_roles w WHERE rolname='matrixkeep_mail_worker';"""
        if sql(admin, check) != "t":
            raise SystemExit("Dedicated worker login failed the least-privilege check.")
        host = admin["PGHOST"]
        if not host.endswith(".pooler.supabase.com"):
            host = input("Production Supabase Connect > Session pooler hostname only: ").strip()
            if not re.fullmatch(r"[a-z0-9-]+\.pooler\.supabase\.com", host):
                raise SystemExit("Invalid Session Pooler hostname.")
        password = secrets.token_urlsafe(48)
        uri = f"postgresql://{LOGIN}.{REF}:{quote(password, safe='')}@{host}:5432/postgres?sslmode=require"
        sql(admin, "ALTER ROLE matrixkeep_mail_worker PASSWORD '" + scram(password) + "';")
    if sql(db_env(uri, ca, worker=True),
           "SET ROLE matrixkeep_mail_sender; SELECT count(*) >= 0 FROM matrixkeep_mail.delivery;") != "t":
        raise SystemExit("Production worker ledger access failed.")
    if not version:
        add(DB, uri)


def main():
    if not shutil.which("psql"):
        raise SystemExit("Install postgresql-client in Cloud Shell, then rerun.")
    number = gcloud("projects", "describe", PROJECT, "--format=value(projectNumber)")
    if number != "517982799169":
        raise SystemExit("Production project number check failed.")
    # Check resources individually. Existing enabled values are never overwritten.
    for name in [DB, *PUBLIC, PASSWORD]:
        create_secret(name)
    for name, value in PUBLIC.items():
        if not enabled(name):
            add(name, value)
    with tempfile.TemporaryDirectory() as temp:
        ca = Path(temp) / "supabase-ca.crt"
        with urllib.request.urlopen("https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt", timeout=20) as cert:
            ca.write_bytes(cert.read())
        database_secret(ca)
    if not enabled(PASSWORD):
        if not sys.stdin.isatty():
            raise SystemExit("Use an interactive Cloud Shell for the hidden Zoho password prompt.")
        password = getpass.getpass("Production Zoho SMTP app password for hello@matrixkeep.com: ")
        if not password.strip():
            raise SystemExit("Empty SMTP password. No version added.")
        try:
            with smtplib.SMTP_SSL(PUBLIC["MATRIXKEEP_SMTP_HOST"], 465, timeout=20,
                                  context=ssl.create_default_context()) as client:
                client.login(PUBLIC["MATRIXKEEP_SMTP_USER"], password)
        except (OSError, smtplib.SMTPException):
            raise SystemExit("Zoho SMTP authentication failed. No password version was stored.") from None
        add(PASSWORD, password)
    if gcloud("iam", "service-accounts", "describe", IDENTITY, "--format=value(email)", optional=True) is None:
        gcloud("iam", "service-accounts", "create", "matrixkeep-mail", "--display-name=MatrixKeep production mail")
    for key in [DB, *PUBLIC, PASSWORD]:
        gcloud("secrets", "add-iam-policy-binding", key, "--member=serviceAccount:" + IDENTITY,
               "--role=roles/secretmanager.secretAccessor", "--condition=None", "--format=none")
    gcloud("iam", "service-accounts", "add-iam-policy-binding", IDENTITY, "--member=" + DEPLOYER,
           "--role=roles/iam.serviceAccountUser", "--condition=None", "--format=none")
    gcloud("services", "enable", "cloudscheduler.googleapis.com")
    role = "matrixkeepMailSchedulerDeployer"
    permissions = {"cloudscheduler.jobs.get", "cloudscheduler.jobs.create", "cloudscheduler.jobs.update"}
    existing = gcloud("iam", "roles", "describe", role, "--format=value(includedPermissions)", optional=True)
    if existing is None:
        gcloud("iam", "roles", "create", role, "--title=MatrixKeep mail scheduler deployer",
               "--permissions=" + ",".join(sorted(permissions)), "--stage=GA")
    elif not permissions.issubset(set(re.findall(r"cloudscheduler\.jobs\.[a-z]+", existing))):
        raise SystemExit("Existing production Scheduler role lacks get/create/update. Review its permissions.")
    gcloud("projects", "add-iam-policy-binding", PROJECT, "--member=" + DEPLOYER,
           "--role=projects/" + PROJECT + "/roles/" + role, "--condition=None", "--format=none")
    print("Production mail prerequisites verified. No credentials printed.")


if __name__ == "__main__":
    main()
