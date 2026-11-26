import { createHash } from "node:crypto";
import postgres from "postgres";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deliverEmail } from "./delivery.mjs";

const config = process.env;
const refs = {
  staging: "cdfpupivjjamhvmfcvry",
  production: "caqtifaytqukimdkyahv",
};
const ref = refs[config.APP_ENV];
const db = new URL(config.MAIL_DATABASE_URL);
if (
  !ref ||
  !(
    db.hostname === "db." + ref + ".supabase.co" ||
    (db.hostname.endsWith(".pooler.supabase.com") && db.username.endsWith("." + ref))
  )
)
  throw Error("Mail database environment mismatch");
for (const key of ["HOST", "PORT", "USER", "PASSWORD"]) {
  if (!config["MATRIXKEEP_SMTP_" + key]) throw Error("Missing SMTP configuration");
}
if (!["465", "587"].includes(config.MATRIXKEEP_SMTP_PORT))
  throw Error("Invalid mail submission port");
function send(message) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [fileURLToPath(new URL("./send-smtp.py", import.meta.url))], {
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 60000,
    });
    child.once("error", reject);
    child.stdin.on("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(Error("Email submission did not complete")),
    );
    child.stdin.end(JSON.stringify(message));
  });
}
const sql = postgres(config.MAIL_DATABASE_URL, { ssl: "verify-full", max: 1 });
try {
  await sql`SET ROLE matrixkeep_mail_sender`;
  const messages = await sql`SELECT * FROM matrixkeep_mail.messages ORDER BY source_id`;
  let attempted = 0;
  for (const m of messages) {
    const key = createHash("sha256")
      .update(JSON.stringify([config.APP_ENV, m.kind, m.source_id, m.source_id]))
      .digest("hex");
    const [prior] = await sql`SELECT state FROM matrixkeep_mail.delivery WHERE delivery_key=${key}`;
    if (prior && prior.state !== "sent") continue;
    if (++attempted > 100) break;
    if (!prior) {
      const result = await deliverEmail({
        sql,
        send,
        kind: m.kind,
        environment: config.APP_ENV,
        occurrence: m.source_id,
        to: m.email,
        fields: m,
        recipientKey: m.source_id,
      });
      if (result !== "sent") continue;
    }
    await sql`DELETE FROM matrixkeep_mail.pending WHERE kind=${m.kind} AND source_id=${m.source_id}`;
  }
} finally {
  await sql.end();
}
