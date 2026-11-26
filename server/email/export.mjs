import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogue } from "./catalogue.mjs";
import { renderEmail, authTemplate } from "./render.mjs";

const [environment, out] = process.argv.slice(2);
if (!["production", "staging"].includes(environment) || !out)
  throw Error("Usage: node export.mjs staging|production output-directory");
const fields = {
  first_name: "Alex",
  email: "alex@example.com",
  inviter_name: "Morgan",
  workspace_name: "Family home",
  plan_name: "Family",
  billing_interval: "Monthly",
  amount: "£14.99",
  renewal_date: "1 February 2027",
  old_plan: "Home+",
  new_plan: "Family",
  effective_date: "1 February 2027",
  payment_date: "1 January 2027",
  billing_period: "1–31 January 2027",
  end_of_period: true,
  access_end_date: "31 January 2027",
  trial_end_date: "14 January 2027",
  voucher_code_masked: "••••7K2",
  voucher_benefit: "One month of Family",
  voucher_expiry: "31 January 2027",
  asset_name: "Kitchen dishwasher",
  relative_date: "in 30 days",
  expiry_date: "31 January 2027",
  provider_name: "Example cover",
  property_name: "Family home",
  policy_name: "Home contents",
  covered_item: "Family home",
  document_name: "Boiler certificate",
  related_asset: "Boiler",
  maintenance_type: "Annual service",
  due_date: "15 January 2027",
  property_or_room: "Kitchen",
  security_event: "A new sign-in was recorded",
  event_date: "2 January 2027 at 09:30 UTC",
  event_context: "Browser in the United Kingdom",
};
await mkdir(join(out, "auth"), { recursive: true });
await mkdir(join(out, "examples"), { recursive: true });
const metadata = {};
for (const [kind, t] of Object.entries(catalogue)) {
  const ref = environment === "production" ? "caqtifaytqukimdkyahv" : "cdfpupivjjamhvmfcvry";
  const type = kind === "confirmation" ? "signup" : kind;
  const data = {
    ...fields,
    action_url: "https://" + ref + ".supabase.co/auth/v1/verify?token=example-only&type=" + type,
  };
  if (kind === "downgraded") Object.assign(data, { old_plan: "Family", new_plan: "Home+" });
  const example = renderEmail(kind, data, environment);
  await writeFile(join(out, "examples", kind + ".html"), example.html);
  await writeFile(join(out, "examples", kind + ".txt"), example.text);
  metadata[kind] = { subject: t.subject, preheader: t.preview };
  if (
    [
      "confirmation",
      "recovery",
      "invite",
      "password_changed_notification",
      "email_changed_notification",
    ].includes(kind)
  ) {
    const auth = authTemplate(kind, environment);
    await writeFile(join(out, "auth", kind + ".html"), auth.html);
    await writeFile(join(out, "auth", kind + ".txt"), auth.text);
  }
}
await writeFile(join(out, "subjects.json"), JSON.stringify(metadata, null, 2) + "\n");
await writeFile(
  join(out, "index.html"),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MatrixKeep email previews</title><main style="max-width:650px;margin:40px auto;padding:16px;font:16px/1.6 Arial;color:#15213b"><h1>MatrixKeep email previews</h1><p>Example data. Authentication links are inactive samples.</p><ol>' +
    Object.keys(metadata)
      .map(
        (k) =>
          '<li><a href="examples/' +
          k +
          '.html">' +
          catalogue[k].action +
          " · " +
          k.replaceAll("_", " ") +
          '</a> (<a href="examples/' +
          k +
          '.txt">plain text</a>)</li>',
      )
      .join("") +
    "</ol></main></html>",
);
