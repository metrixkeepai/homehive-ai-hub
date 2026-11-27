import { createHash } from "node:crypto";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deliverEmail } from "./delivery.mjs";

import { billingOwners } from "./ownership.mjs";

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
const qaRecipient = config.MATRIXKEEP_MAIL_QA_RECIPIENT?.trim().toLowerCase() || null;
if (
  (config.APP_ENV === "staging" || config.MATRIXKEEP_MAIL_QA_RECIPIENT !== undefined) &&
  (!qaRecipient || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(qaRecipient))
)
  throw Error("Restricted mail delivery requires one QA recipient");
const sql = postgres(config.MAIL_DATABASE_URL, {
  ssl: {
    ca: readFileSync(new URL("../../supabase-db-ca.crt", import.meta.url)),
    rejectUnauthorized: true,
  },
  max: 1,
});
try {
  await sql`SET ROLE matrixkeep_mail_sender`;
  if (config.MATRIXKEEP_STAGING_DELIVERY_QA === "true") {
    const { exerciseStagingDelivery } = await import("./staging-acceptance.mjs");
    await exerciseStagingDelivery({ sql, send, environment: config.APP_ENV, to: qaRecipient });
  }
  const messages =
    await sql`SELECT * FROM matrixkeep_mail.messages WHERE (${qaRecipient}::text IS NULL OR lower(email)=${qaRecipient}::text) ORDER BY source_id`;
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
        fields: { ...m, ...m.display_fields },
        billingOwners,
        recipientKey: m.source_id,
      });
      if (result !== "sent") continue;
    }
    await sql`DELETE FROM matrixkeep_mail.pending WHERE kind=${m.kind} AND source_id=${m.source_id}`;
  }
  if (attempted < 100) {
    const reminders =
      await sql`SELECT kind, source_id, due FROM matrixkeep_mail.due_reminders WHERE (${qaRecipient}::text IS NULL OR lower(email)=${qaRecipient}::text) ORDER BY due,source_id`;
    for (const r of reminders) {
      if (attempted >= 100) break;
      // Re-read the opt-in, owner access, due date and active record at dispatch time.
      const [m] = await sql`SELECT * FROM matrixkeep_mail.due_reminders
        WHERE source_id=${r.source_id} AND due=${r.due} AND kind=${r.kind} AND (${qaRecipient}::text IS NULL OR lower(email)=${qaRecipient}::text)`;
      if (!m) continue;
      const stamp = new Date(m.due + "T00:00:00Z");
      const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
        stamp,
      );
      const fields = {
        ...m,
        relative_date: "on " + date,
        expiry_date: date,
        renewal_date: date,
        due_date: date,
        policy_name: m.title,
        document_name: m.title,
        maintenance_type: m.title,
      };
      const result = await deliverEmail({
        sql,
        send,
        kind: m.kind,
        environment: config.APP_ENV,
        occurrence: m.source_id + ":" + m.due,
        recipientKey: m.source_id,
        to: m.email,
        fields,
      });
      if (result === "sent") attempted++;
    }
  }
} finally {
  await sql.end();
}
