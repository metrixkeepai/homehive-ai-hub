import { photos } from "./media";
export function marketingHead(
  title: string,
  description: string,
  path: string,
  image = photos.world,
) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: `https://matrixkeep.com${path}` }],
  };
}
export const commonFaq: [string, string][] = [
  [
    "What is MatrixKeep?",
    "MatrixKeep is an AI-powered Asset Intelligence and Digital Passport platform. It connects saved assets, receipts, warranties, documents, maintenance and renewals so you can find information and review important dates.",
  ],
  [
    "Who is MatrixKeep designed for?",
    "Individuals, families and small or medium businesses can use the existing platform. Enterprises and potential partners can discuss their requirements and pilot opportunities with the team.",
  ],
  [
    "Can I use it for my home and business?",
    "Yes. Individual and Business account options and separate workspaces help keep personal and business records organised. Available features and capacities depend on your plan.",
  ],
  [
    "What is a Digital Asset Passport?",
    "A connected record of an asset or property, including its identity, purchase information, evidence, warranty and saved maintenance history. You can choose what to include when exporting or sharing a passport.",
  ],
  [
    "How does Sera AI work?",
    "Sera helps answer questions using your saved workspace records. AI output should be reviewed against the source documents; it is not a professional valuation or legal assessment.",
  ],
  [
    "Can I organise warranty documents?",
    "Yes. Save purchase receipts and warranty evidence, review extracted dates and track the cover recorded for each item.",
  ],
  [
    "Can I manage multiple properties or business locations?",
    "Yes, within your plan allowance. Connect rooms, equipment and saved records to the appropriate property or location.",
  ],
  [
    "Can I use MatrixKeep for insurance evidence?",
    "You can organise receipts, photos, serial numbers and documents to support your own evidence preparation. Your insurer determines the evidence needed and whether a claim is accepted.",
  ],
  [
    "How is my information handled?",
    "Records are scoped to your account and workspace. Evidence access and passport sharing use the existing access controls. See our Privacy Policy and Security page for more information.",
  ],
  [
    "Does this replace a compliance assessment?",
    "No. MatrixKeep helps organise records and dates. Qualified professionals remain responsible for inspections, legal advice and compliance decisions. Advanced automated assurance is a roadmap area.",
  ],
  [
    "What happens when I change subscription?",
    "Upgrades take effect immediately with prorated billing. Downgrades and cancellations take effect at the end of the paid period. See your account Plans page for the existing options.",
  ],
  [
    "How do reminders work?",
    "Review important dates in MatrixKeep and download calendar reminders. Google Calendar actions are available when your account is connected and your plan permits them. Automated email, WhatsApp and push delivery should not be assumed.",
  ],
  [
    "How do I get started?",
    "Create an account, select the appropriate account type and add your first asset or document. Start Free links open the existing sign-in and registration page.",
  ],
  [
    "Can businesses request a demonstration?",
    "Yes. Use the Contact page to prepare an email to the MatrixKeep team with your business requirements.",
  ],
  [
    "Can enterprises discuss a pilot?",
    "Yes. Contact us to discuss practical use cases, feasibility, access requirements and the scope of a potential pilot. No deployment or partnership is implied before agreement.",
  ],
];
