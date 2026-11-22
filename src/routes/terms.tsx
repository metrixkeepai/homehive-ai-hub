import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/hv/Site";
const sections = [
  [
    "Your agreement",
    "These terms govern your use of MatrixKeep, provided by Scalivora AI Ltd, company 17363748, registered in England. By opening an account or using the service you agree to these terms. If you act for an organisation, you must have authority to agree on its behalf. Contact hello@matrixkeep.com with questions.",
  ],
  [
    "What MatrixKeep provides",
    "MatrixKeep helps households and organisations organise records, evidence, locations, reminders and Digital Passports. Features and usage allowances depend on the plan shown in your account. Keep originals of important documents and independent reminders for critical deadlines.",
  ],
  [
    "Accounts and authorised use",
    "Provide accurate account information, protect sign-in credentials and manage invitations, connected accounts and workspace access carefully. Tell us promptly about unauthorised access. Only upload, import or share material you have permission to use. Do not access another person’s account, introduce malicious content, circumvent access controls or quotas, or use the service unlawfully.",
  ],
  [
    "Plans, trials and payments",
    "The price, billing interval, applicable taxes, trial conditions and renewal terms shown at checkout form part of your purchase. Paid subscriptions are billed through Stripe. If a trial converts to a paid subscription, check the date and price shown before confirming. You may manage or cancel via Subscription & Billing or contact us for help. A scheduled cancellation takes effect on the date confirmed. Check the displayed effective date and any prorated charge before changing plan. Statutory cancellation and refund rights continue to apply.",
  ],
  [
    "Your content",
    "You retain your rights in your content. You give us the limited permission needed to store, process, back up and display it, generate the outputs you request and share it according to your settings. You are responsible for permissions relating to other people’s information and documents. MatrixKeep and its licensors retain their rights in the software, branding and service materials.",
  ],
  [
    "Connected services",
    "Connecting an account authorises the selected provider permissions. Provider terms also apply. Manual imports and opted-in background checks can produce proposals for review. Review the destination and proposed records before saving. You can disconnect through Integrations. An interruption or withdrawal of provider access can stop future checks. Saved records remain in your workspace.",
  ],
  [
    "AI assistance and your review",
    "Sera, speech transcription, translation, image analysis and document extraction can omit information, misunderstand speech or return incorrect results. Verify amounts, dates, model numbers, warranties, contract clauses and insurance or renewal deadlines against the original evidence before relying on them. An AI answer does not provide professional, financial, legal or insurance advice.",
  ],
  [
    "Sharing a Digital Passport",
    "Check the property, included sections, recipient and expiry before sending a link. A recipient may forward a link or retain a copy. Revoke access if a link is sent in error. Expiry and revocation control future access through MatrixKeep.",
  ],
  [
    "Availability and ending access",
    "Maintenance, outages and provider changes can interrupt the service. We may restrict access when reasonably necessary for security, unlawful activity, material breach or unpaid charges. Where appropriate we will give notice and an opportunity to resolve the issue. You can cancel a subscription or contact us to close an account and request deletion. Export records you need before closure.",
  ],
  [
    "Liability and consumer rights",
    "We are responsible for foreseeable loss caused by our breach or failure to use reasonable care and skill. We do not exclude liability for fraud, death or personal injury caused by negligence, or any liability the law does not allow us to limit. Your statutory rights concerning digital content and services remain available.",
  ],
  [
    "Law, changes and contact",
    "These terms are governed by the law of England and Wales. Courts in England and Wales have jurisdiction, subject to consumers’ rights to rely on mandatory local protections and bring claims in the courts available to them where they live. Updated terms will carry a new effective date. We will give appropriate notice of material changes and obtain agreement where required. Write to Scalivora AI Ltd at 33 Electric Avenue, Westcliff-on-Sea, England, SS0 9NW, or email hello@matrixkeep.com.",
  ],
] as const;
export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MatrixKeep" },
      {
        name: "description",
        content:
          "Terms for using MatrixKeep, managing subscriptions, connecting accounts and sharing Digital Passports.",
      },
    ],
  }),
  component: Page,
});
function Page() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
        <p className="mt-3 text-muted-foreground">Effective 22 November 2026</p>
        {sections.map(([heading, body]) => (
          <section key={heading} className="mt-8">
            <h2 className="font-display text-xl font-semibold">{heading}</h2>
            <p className="mt-2 leading-relaxed">{body}</p>
          </section>
        ))}
        <p className="mt-6">
          <a className="underline" href="mailto:hello@matrixkeep.com">
            Email MatrixKeep
          </a>
        </p>
      </article>
    </SiteShell>
  );
}
