import { catalogue } from "./catalogue.mjs";

const environments = {
  production: ["https://matrixkeep.com", "https://caqtifaytqukimdkyahv.supabase.co"],
  staging: [
    "https://matrixkeep-staging-web-893477687403.europe-west2.run.app",
    "https://cdfpupivjjamhvmfcvry.supabase.co",
  ],
};
const authenticated = [
  "confirmation",
  "recovery",
  "invite",
  "password_changed_notification",
  "email_changed_notification",
];
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const clean = (value) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
const support = "hello@matrixkeep.com";
const tagline = "Keep what matters. Know what’s next.";
const description = "Your intelligent digital home and asset passport.";

function signedAction(raw, origin, authOrigin, kind) {
  const url = new URL(raw);
  if (
    url.origin !== authOrigin ||
    url.username ||
    url.password ||
    url.pathname !== "/auth/v1/verify" ||
    !url.searchParams.get("token") ||
    !{
      confirmation: ["signup", "email"],
      recovery: ["recovery"],
      invite: ["invite"],
    }[kind].includes(url.searchParams.get("type"))
  ) {
    throw Error("Invalid email action link");
  }
  const redirect = url.searchParams.get("redirect_to");
  if (redirect && new URL(redirect).origin !== origin)
    throw Error("Invalid email return destination");
  return url.href;
}

function render(kind, data, environment, native) {
  if (!Object.hasOwn(catalogue, kind) || !Object.hasOwn(environments, environment))
    throw Error("Unknown email template or environment");
  const template = catalogue[kind];
  const t =
    kind === "downgraded" && data.already_effective === true
      ? {
          ...template,
          preview: "Your subscription has changed.",
          before: [
            "Your MatrixKeep subscription changed from {old_plan} to {new_plan} on {effective_date}.",
            "Your new plan limits now apply.",
          ],
        }
      : template;
  const [origin, authOrigin] = environments[environment];
  const value = (key) => {
    const v = clean(data[key]);
    if (
      /\b(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|(?:cus|sub|price|pi|in|evt|sk_live|sk_test|sb_secret|whsec)_[a-z0-9_-]+)\b/i.test(
        v,
      ) ||
      /\{\{/.test(v)
    )
      throw Error("Unexpected internal value for " + key);
    return v;
  };
  const defaults = {
    inviter_name: "A workspace member",
    workspace_name: "a shared workspace",
  };
  function fill(line) {
    return line.replace(/\{(\w+)\}/g, (_, key) => {
      const v = value(key) || defaults[key];
      if (!v) throw Error("Missing display field: " + key);
      return v;
    });
  }
  const subject = fill(t.subject),
    preview = fill(t.preview),
    name = value("first_name");
  const title = kind === "welcome" && name ? t.title + ", " + name : fill(t.title);
  const greeting = kind === "welcome" && name ? "" : "Hi " + (name || "there") + ",";
  const url = t.signed
    ? native
      ? "{{ .ConfirmationURL }}"
      : signedAction(data.action_url, origin, authOrigin, kind)
    : origin + t.path;
  const paragraphs = t.before.map(fill);
  if (kind === "cancelled" && data.end_of_period === true)
    paragraphs.push(
      fill("You can continue using your current paid features until {access_end_date}."),
    );
  const details = (t.details || []).flatMap(([label, key]) => {
    let v = value(key);
    if (key === "voucher_code_masked" && v && !/^[*•]+[-\w]{0,4}$/.test(v)) v = "••••";
    return v ? [[label, v]] : [];
  });
  const p = (line) =>
    '<p style="margin:0 0 16px">' +
    escape(line).replaceAll(
      support,
      '<a style="color:#254599" href="mailto:' + support + '">' + support + "</a>",
    ) +
    "</p>";
  const list = (items, tag) =>
    items
      ? "<" +
        tag +
        ' style="margin:0 0 20px;padding-left:24px">' +
        items.map((i) => "<li>" + escape(i) + "</li>").join("") +
        "</" +
        tag +
        ">"
      : "";
  const after = (t.after || []).map(fill);
  const fallback =
    "If the button does not work, copy the link address below and paste it into your browser.";
  const h = escape(url);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f5f6f8;color:#15213b;font:16px/1.55 Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f6f8"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #dce2ec;border-radius:20px"><tr><td height="6" bgcolor="#367a94" style="border-radius:20px 20px 0 0;background-image:linear-gradient(90deg,#3446ae,#24859b,#54cecd);font-size:1px">&nbsp;</td></tr>
<tr><td style="padding:30px 24px 16px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#15213b">
<div style="font:bold 26px Georgia,serif;margin-bottom:32px">Matrix<span style="color:#007c87">Keep</span></div>
<h1 style="font: bold 29px/1.2 Georgia,serif;margin:0 0 24px">${escape(title)}</h1>
${greeting ? p(greeting) : ""}${paragraphs.map(p).join("")}${list(t.list, "ul")}
${details.length ? '<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f6f8" style="border-radius:12px;margin-bottom:20px">' + details.map(([k, v]) => '<tr><th scope="row" align="left" style="padding:8px 12px;font-size:14px">' + escape(k) + '</th><td style="padding:8px 12px;overflow-wrap:anywhere">' + escape(v) + "</td></tr>").join("") + "</table>" : ""}
${t.summary ? p(t.summary) : ""}${list(t.steps, "ol")}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td bgcolor="#3446ae" style="border-radius:24px;mso-padding-alt:12px 22px"><a href="${h}" style="display:inline-block;padding:12px 22px;color:#fff;font:bold 16px/20px Arial,sans-serif;text-decoration:none">${escape(t.action)}</a></td></tr></table>
${t.signed ? p(fallback) + '<p style="word-break:break-all;font-size:14px"><a href="' + h + '">Your secure MatrixKeep link</a></p>' : ""}${after.map(p).join("")}
</td></tr><tr><td style="padding:20px 24px;border-top:1px solid #dce2ec;color:#47536a;font:14px/1.6 Arial,sans-serif"><strong>MatrixKeep</strong><br>${tagline}<br>${description}<br><a href="${origin}" style="color:#254599">matrixkeep.com</a> · <a href="mailto:${support}" style="color:#254599">${support}</a></td></tr></table>
<!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = [
    title,
    greeting,
    ...paragraphs,
    t.list?.map((i) => "• " + i).join("\n"),
    details.map(([k, v]) => k + ": " + v).join("\n"),
    t.summary,
    t.steps?.map((s, i) => i + 1 + ". " + s).join("\n"),
    t.action + "\n" + url,
    ...after,
    "MatrixKeep\n" + tagline + "\n" + description + "\n" + origin + "\n" + support,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    from: "MatrixKeep <" + support + ">",
    replyTo: support,
    subject,
    preheader: preview,
    html,
    text,
  };
}

export function renderEmail(kind, data, environment) {
  return render(kind, data, environment, false);
}

// Export real Go templates. Only fixed, application-owned expressions enter this pass.
export function authTemplate(kind, environment) {
  if (!authenticated.includes(kind)) throw Error("Unsupported authentication template");
  const fields = {
    first_name: "MKFIRSTNAME",
    email: "MKEMAIL",
    inviter_name: "MKINVITER",
    workspace_name: "MKWORKSPACE",
  };
  const message = render(kind, fields, environment, true);
  const substitutions = {
    MKEMAIL: "{{ .Email }}",
    MKFIRSTNAME: "{{ with .Data.first_name }}{{ . }}{{ else }}there{{ end }}",
    MKINVITER: "{{ with .Data.inviter_name }}{{ . }}{{ else }}A workspace member{{ end }}",
    MKWORKSPACE: "{{ with .Data.workspace_name }}{{ . }}{{ else }}a shared workspace{{ end }}",
  };
  for (const part of ["html", "text", "preheader"]) {
    for (const [marker, expression] of Object.entries(substitutions))
      message[part] = message[part].replaceAll(marker, expression);
  }
  return message;
}
