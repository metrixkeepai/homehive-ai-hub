import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/hv/Site";
const sections = [
  [
    "Who is responsible",
    "Scalivora AI Ltd (company 17363748, registered in England) operates MatrixKeep. Email hello@matrixkeep.com with privacy requests or write to our registered office at 33 Electric Avenue, Westcliff-on-Sea, England, SS0 9NW. We are the controller for personal accounts, account administration, billing and service security. Where a business determines why its workspace contains personal data and we process it on its instructions, it is the controller for that content. Contact the business for those requests, or ask us to help identify the right contact.",
  ],
  [
    "What you put in MatrixKeep",
    "We use account and profile details, household or business workspace information, and records you enter or import. These can include property and location details, rooms, assets, vehicles, documents, warranties, renewals, insurance, maintenance, services, tasks and evidence. Photos, recordings and documents may identify other people. Only provide information you are authorised to use.",
  ],
  [
    "Why we process it",
    "We use account, workspace and subscription data to provide the service you request and perform our contract. We use diagnostic events, access records and usage totals for our legitimate interests in security, fraud prevention and reliability. We process payment and accounting records to administer subscriptions and meet legal obligations. Optional connector access depends on your authorisation. You can withdraw that permission and disable background checks.",
  ],
  [
    "When you connect Google",
    "You choose each Google service in Integrations. Gmail uses read-only access to search for relevant receipts, invoices, orders, contracts, warranties and renewals. We inspect message metadata, relevant text and eligible attachments. Drive uses read-only access to list, search and read chosen files or eligible new files during an authorised check. Calendar uses event access for MatrixKeep reminders you request. Connecting one service does not start a scan of the others.",
  ],
  [
    "When you connect Microsoft",
    "Outlook uses delegated read access to inspect relevant messages and attachments in the connected inbox. OneDrive uses delegated read access to browse and read selected or eligible new files. Offline permission lets MatrixKeep renew authorised access. Neither connector sends email, deletes messages or edits your files.",
  ],
  [
    "Discovery, review and evidence",
    "Manual checks begin when you request them. Twice-monthly automatic checks require opt-in. We keep a checkpoint and source identifiers to find new material and avoid duplicates. Relevant content may be sent for extraction. Proposed fields and provenance enter a review queue. You can edit, select, assign a property or room and approve records. On approval, selected records become ordinary workspace records and eligible attachments are copied into evidence storage. Provenance can include the account, sender, subject, date, provider identifiers and filename.",
  ],
  [
    "AI processing",
    "When you use capture, Speak or Sera, relevant text, images, documents, audio or retrieved record excerpts may be processed by OpenAI. This supports transcription, translation into English, extraction, record suggestions and answers about saved information. Some counts and insights are calculated directly from records. Check suggestions against the source before saving or acting on them. Exact-result caches can reuse earlier work within the applicable account and workspace.",
  ],
  [
    "Google Limited Use",
    "MatrixKeep uses and transfers information received from Google APIs in accordance with the Google API Services User Data Policy, including its Limited Use requirements. Google data is used to deliver the connected features you request. We do not sell it, use it for advertising or use it to train general-purpose AI models. Access by people is restricted to circumstances permitted by that policy, such as your specific agreement to support access, a security investigation or a legal requirement.",
  ],
  [
    "Who receives data",
    "We use Google Cloud for hosting, Supabase for authentication, database and file storage, OpenAI for AI requests, and Stripe for subscription payments. Google and Microsoft handle consent and connected-service requests. Payment card details are entered with the payment provider. Your sharing choices also matter: people with access to a workspace or a valid Digital Passport link can see the information made available to them. Revoking a link cannot recall a copy already downloaded.",
  ],
  [
    "Storage, disconnection and deletion",
    "Saved records and evidence are kept to operate your account until removed or the account is closed, subject to legal obligations and necessary recovery copies. Disconnecting removes the stored MatrixKeep credential and stops future checks. Previously imported records remain available for you to manage. Provider-side access can also be withdrawn in your Google or Microsoft account. A daily cleanup removes unapproved proposals and dismissed items older than 90 days. After approval, duplicate-detection identifiers are kept so another scan can recognise the same source. Redundant proposal contents are cleared after 90 days. To request deletion of account content, pending imports and associated evidence, contact us from your registered email. We verify identity and explain any material we must retain for accounting, security or legal claims.",
  ],
  [
    "Security and overseas processing",
    "MatrixKeep uses authenticated access, workspace and ownership checks, controlled evidence access and server-side encryption of stored connector credentials. No online service can guarantee absolute security. Service providers may process information outside the UK. Where a restricted transfer takes place, an applicable adequacy decision or appropriate contractual safeguards are required. Contact us for details of the safeguards relevant to your information.",
  ],
  [
    "Your rights and children’s information",
    "Depending on the circumstances, you can request access, correction, erasure, restriction or portability, object to processing based on legitimate interests, and withdraw consent for future processing. You can also complain to the UK Information Commissioner’s Office. When family records include a child, share only information you are entitled to manage. Contact us if a child’s information or account needs review or removal.",
  ],
  [
    "Policy updates",
    "We publish changes on this page with the effective date. Material changes affecting an existing account will be brought to the account holder’s attention before they apply where required.",
  ],
] as const;
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MatrixKeep" },
      {
        name: "description",
        content:
          "How MatrixKeep handles your account, evidence, connected services and AI requests, and how to exercise your privacy rights.",
      },
    ],
  }),
  component: Page,
});
function Page() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
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
        <p className="mt-4">
          <a
            className="underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>{" "}
          ·{" "}
          <a className="underline" href="https://ico.org.uk/make-a-complaint/">
            Contact the ICO
          </a>
        </p>
      </article>
    </SiteShell>
  );
}
