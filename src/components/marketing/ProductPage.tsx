import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  FileText,
  Package,
  ShieldCheck,
  Wrench,
  Car,
  CalendarClock,
  Sparkles,
  Eye,
  Share2,
  Lock,
  Users,
  Heart,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteShell, PageHero, FeatureGrid, FAQ, CTA, FeedCard } from "@/components/hv/Site";
import { photos } from "./media";
import { PassportDemo, SeraDemo } from "./Demos";
import { Capabilities, Intelligence, Journey, Trust } from "./Sections";
import { commonFaq } from "./content";
export type ProductKind =
  | "features"
  | "ai-agents"
  | "sera"
  | "digital-passport"
  | "partners"
  | "how-it-works"
  | "about"
  | "security";
export const productContent = {
  features: {
    eyebrow: "The MatrixKeep platform",
    title: "Asset intelligence for everything you own and operate.",
    lead: "Replace fragmented records with connected assets, evidence and dates. MatrixKeep helps you know what you own, find what matters and review what needs attention.",
    image: photos.world,
  },
  "ai-agents": {
    eyebrow: "AI Agents · Assisted intelligence",
    title: "A little intelligence. A lot less searching.",
    lead: "AI-assisted capture and interpretation connect real-world information to structured records. Review the source, confirm the details and decide your next step.",
    image: photos.world,
  },
  sera: {
    eyebrow: "Meet Sera AI",
    title: "The answer is in your records. Sera helps you find it.",
    lead: "Ask everyday questions about your saved assets, warranties, receipts and renewals. Keep the evidence close and the final decision yours.",
    image: photos.world,
  },
  "digital-passport": {
    eyebrow: "Digital Asset Passports",
    title: "Every asset has a story. Keep yours connected.",
    lead: "Identity, purchase information, warranties, documents and recorded maintenance history — one digital memory for an asset, vehicle or property.",
    image: photos.world,
  },
  partners: {
    eyebrow: "Partner opportunities",
    title: "Build the future of asset intelligence. Together.",
    lead: "We welcome conversations with organisations exploring practical asset intelligence, connected evidence, responsible AI and pilot opportunities.",
    image: photos.world,
  },
  "how-it-works": {
    eyebrow: "How it works",
    title: "From a receipt in a drawer to a record you can use.",
    lead: "Capture, understand, organise, review and act. MatrixKeep keeps information connected to the real-world things it belongs to.",
    image: photos.world,
  },
  about: {
    eyebrow: "About MatrixKeep",
    title: "What matters deserves a better memory.",
    lead: "We are building the AI-powered Asset Intelligence and Digital Passport Platform for everything people and organisations own and operate.",
    image: photos.world,
  },
  security: {
    eyebrow: "Security & Privacy",
    title: "Important information. Thoughtful controls.",
    lead: "Your records, connected services and sharing choices matter. MatrixKeep uses authenticated access, scoped records and controlled sharing, with human oversight of AI.",
    image: photos.world,
  },
} as const;
const agents = [
  {
    icon: Camera,
    t: "Vision Intelligence",
    d: "Supported photo and room capture helps identify items. Check brand, model and serial details before saving.",
  },
  {
    icon: FileText,
    t: "Document Intelligence",
    d: "Extract relevant details from supported receipts, invoices, contracts and documents for review.",
  },
  {
    icon: Package,
    t: "Asset Intelligence",
    d: "Connect saved identity, locations, recorded values and supporting information.",
  },
  {
    icon: ShieldCheck,
    t: "Warranty Intelligence",
    d: "Interpret available cover information and review derived expiry dates against the source.",
  },
  {
    icon: CalendarClock,
    t: "Renewal Intelligence",
    d: "Identify saved renewal dates and contract notice deadlines where the document supports them.",
  },
  {
    icon: Wrench,
    t: "Maintenance Intelligence",
    d: "Organise saved service requirements and history. This is not a prediction of equipment failure.",
  },
  {
    icon: Car,
    t: "Vehicle Intelligence",
    d: "Keep recorded vehicle information, service evidence and important dates together.",
  },
  {
    icon: Sparkles,
    t: "Sera AI Assistant",
    d: "Ask questions about your saved workspace records and review relevant answers.",
  },
];
export function ProductPage({ kind }: { kind: ProductKind }) {
  const c = productContent[kind];
  return (
    <SiteShell>
      <PageHero
        eyebrow={c.eyebrow}
        title={c.title}
        lead={c.lead}
        cta={kind === "partners" ? "Talk to the Team" : "Start Free"}
      />
      {kind === "features" && (
        <>
          <Capabilities />
          <PassportDemo />
          <SeraDemo />
          <Journey />
        </>
      )}
      {kind === "ai-agents" && (
        <>
          <FeatureGrid
            title="AI assistance, built around your evidence."
            lead="Available capabilities depend on the capture method, source quality and your plan. AI can make mistakes; source documents remain essential."
            items={agents}
          />
          <Intelligence />
          <section className="mk-container mk-section mk-split">
            <div>
              <p className="mk-eyebrow">A responsible roadmap</p>
              <h2>
                Advanced assurance.
                <br />
                With people at the centre.
              </h2>
              <p className="mk-lead">
                Compliance Assurance, Evidence Verification, Risk Intelligence and Action &
                Remediation are advanced roadmap areas. Autonomous compliance decisions and
                predictive maintenance are not presented as currently available.
              </p>
            </div>
            <FeedCard
              title="Human-supervised intelligence"
              rows={[
                ["Source evidence", "Preserve context"],
                ["AI suggestion", "Check the details"],
                ["Human review", "Approve or correct"],
                ["Next action", "Your decision"],
              ]}
            />
          </section>
        </>
      )}
      {kind === "sera" && (
        <>
          <SeraDemo />
          <section className="mk-container mk-section mk-split">
            <div>
              <p className="mk-eyebrow">Answers with context</p>
              <h2>
                Not a guess about your life.
                <br />A conversation about your records.
              </h2>
              <p className="mk-lead">
                Sera works with the information saved in the active workspace. Missing records
                cannot become verified facts. Review dates, amounts and advice against the original
                evidence before acting.
              </p>
            </div>
            <img
              src={photos.it}
              alt="Workstation with purchase documents"
              width="627"
              height="627"
              loading="lazy"
            />
          </section>
        </>
      )}
      {kind === "digital-passport" && (
        <>
          <PassportDemo />
          <FeatureGrid
            title="One identity. A connected lifecycle."
            items={[
              {
                icon: Package,
                t: "Asset identity",
                d: "Category, model, serial number, location and recorded purchase value.",
              },
              {
                icon: FileText,
                t: "Purchase and supporting evidence",
                d: "Receipts, invoices, photographs and documents in context.",
              },
              {
                icon: ShieldCheck,
                t: "Warranty and maintenance",
                d: "Saved cover information, servicing requirements and recorded history.",
              },
              {
                icon: Share2,
                t: "Controlled sharing",
                d: "Choose included information and create an expiring passport link. Revoke future access when needed.",
              },
              {
                icon: Eye,
                t: "Privacy choices",
                d: "Review report sections and the details included before sharing.",
              },
              {
                icon: Link2,
                t: "Property and vehicle context",
                d: "Build passports for individual assets, vehicles and property or business locations.",
              },
            ]}
          />
          <section className="mk-tint">
            <div className="mk-container mk-section">
              <h2>
                Share what is useful.
                <br />
                Keep control of what is included.
              </h2>
              <p className="mk-lead">
                A shared passport is a selected snapshot, not an open door into your workspace.
                Recipients may retain copies, so check content and expiry before sending. A passport
                is not proof of legal title or a certified valuation.
              </p>
            </div>
          </section>
        </>
      )}
      {kind === "partners" && (
        <>
          <section className="mk-container mk-section mk-split">
            <div>
              <p className="mk-eyebrow">Become a Pilot Partner</p>
              <h2>
                Practical problems.
                <br />
                Meaningful possibilities.
              </h2>
              <p className="mk-lead">
                Bring a clear use case: equipment records, property evidence, lifecycle
                documentation or operational obligations. Together we can discuss requirements,
                feasibility and the scope of a potential pilot.
              </p>
              <div className="mk-actions">
                <Button asChild>
                  <Link to="/contact">
                    Discuss a Pilot
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <img
              src={photos.enterprise}
              alt="Operations team exploring a business problem"
              width="429"
              height="407"
              loading="lazy"
            />
          </section>
          <FeatureGrid
            title="Different ways to explore the opportunity."
            items={[
              {
                icon: Package,
                t: "Industry use cases",
                d: "Evaluate real equipment, document and lifecycle challenges in your sector.",
              },
              {
                icon: Link2,
                t: "Strategic integrations",
                d: "Discuss data flows and responsibilities before any new integration is agreed.",
              },
              {
                icon: Users,
                t: "Enterprise licensing",
                d: "Scope users, locations, access and support requirements with the team.",
              },
              {
                icon: Eye,
                t: "Responsible evaluation",
                d: "Define review criteria and keep people responsible for consequential decisions.",
              },
              {
                icon: Share2,
                t: "White-label discussions",
                d: "Explore commercial licensing and branding feasibility; availability requires agreement.",
              },
              {
                icon: FileText,
                t: "Evidence-led pilots",
                d: "Start with a focused set of records and agreed outcomes, not unverified claims.",
              },
            ]}
          />
          <Intelligence />
        </>
      )}
      {kind === "how-it-works" && (
        <>
          <Journey />
          <section className="mk-container mk-section mk-split">
            <img
              src={photos.appliance}
              alt="Washing machine and its purchase receipt"
              width="627"
              height="627"
              loading="lazy"
            />
            <div>
              <p className="mk-eyebrow">From capture to context</p>
              <h2>
                The details become useful
                <br />
                when they belong together.
              </h2>
              <p className="mk-lead">
                A receipt can become purchase information and connected evidence. Warranty terms can
                suggest dates. Review each proposal before creating records and keep the original
                document available.
              </p>
              <FeedCard
                title="Example capture journey"
                rows={[
                  ["Receipt uploaded", "Source preserved"],
                  ["Purchase details", "Ready for review"],
                  ["Appliance linked", "Property assigned"],
                  ["Warranty date", "Confirm against terms"],
                ]}
              />
            </div>
          </section>
          <PassportDemo />
          <SeraDemo />
        </>
      )}
      {kind === "about" && (
        <>
          <section className="mk-container mk-section mk-split">
            <div>
              <p className="mk-eyebrow">Why we are building MatrixKeep</p>
              <h2>
                Information is everywhere.
                <br />
                Clarity should be, too.
              </h2>
              <p className="mk-lead">
                People and businesses already own much of the information they need. It lives in
                emails, drawers, spreadsheets and someone’s memory. MatrixKeep brings it into
                context, around the things it belongs to.
              </p>
              <p className="mk-lead">
                Our focus is simple: protect the investment in your assets, reduce the effort of
                finding information and help you review important dates before they become urgent.
              </p>
            </div>
            <img
              src={photos.family}
              alt="A household reviewing important purchase information"
              width="429"
              height="407"
              loading="lazy"
            />
          </section>
          <FeatureGrid
            title="What we believe."
            items={[
              {
                icon: Heart,
                t: "Useful, not overwhelming",
                d: "Information should make everyday life and operations clearer.",
              },
              {
                icon: Eye,
                t: "People remain in control",
                d: "AI supports review and decisions; it does not replace professional judgement.",
              },
              {
                icon: Lock,
                t: "Information deserves care",
                d: "Thoughtful access, sharing and privacy choices belong at the centre.",
              },
            ]}
          />
          <section className="mk-tint">
            <div className="mk-container mk-section">
              <p className="mk-eyebrow">Company information</p>
              <h2>MatrixKeep by Scalivora AI Ltd.</h2>
              <p className="mk-lead">
                Company 17363748, registered in England.
                <br />
                33 Electric Avenue, Westcliff-on-Sea, England, SS0 9NW.
              </p>
              <Button asChild variant="link">
                <Link to="/contact">
                  Get in touch
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </section>
        </>
      )}
      {kind === "security" && (
        <>
          <FeatureGrid
            title="Controls around the information you keep."
            items={[
              {
                icon: Lock,
                t: "Authenticated access",
                d: "The existing account system supports confirmed email and Google sign-in.",
              },
              {
                icon: Package,
                t: "Scoped records",
                d: "Ownership and workspace checks govern access to saved records.",
              },
              {
                icon: FileText,
                t: "Controlled evidence access",
                d: "Evidence uses the existing private storage and authorised access workflow.",
              },
              {
                icon: Share2,
                t: "Selected passport snapshots",
                d: "Choose content, set expiry and revoke future access to shared passports.",
              },
              {
                icon: Link2,
                t: "Your connected accounts",
                d: "Per-user Google and Microsoft connections use server-side stored credentials, not a shared company account.",
              },
              {
                icon: Eye,
                t: "Human oversight",
                d: "Review AI-generated suggestions and retain independent reminders for critical deadlines.",
              },
            ]}
          />
          <section className="mk-container mk-section mk-split">
            <div>
              <h2>
                Clear boundaries.
                <br />
                No absolute promises.
              </h2>
              <p className="mk-lead">
                No online service can guarantee absolute security. This website does not claim
                certifications, regulatory approval or guaranteed compliance. Contact us to discuss
                the controls relevant to your requirements.
              </p>
              <div className="mk-actions">
                <Button asChild variant="outline">
                  <Link to="/privacy">Read the Privacy Policy</Link>
                </Button>
                <Button asChild variant="link">
                  <Link to="/terms">Terms of Service</Link>
                </Button>
              </div>
            </div>
            <FeedCard
              title="Information under your control"
              rows={[
                ["Connected services", "Your authorisation"],
                ["AI processing", "Review the source"],
                ["Passport sharing", "Selected content + expiry"],
                ["Important deadlines", "Independent checks"],
              ]}
            />
          </section>
        </>
      )}
      <FAQ
        items={
          kind === "partners"
            ? [
                [
                  "Are partnerships already confirmed?",
                  "This page invites discussions. No client, pilot, endorsement or commercial partnership is implied before agreement.",
                ],
                [
                  "How do I propose a pilot?",
                  "Use Contact to prepare an email describing the asset types, locations, evidence and intended outcomes.",
                ],
                [
                  "Is advanced compliance assurance deployed?",
                  "Advanced assurance capabilities are roadmap areas. Current records and evidence workflows remain human-reviewed.",
                ],
              ]
            : commonFaq.filter((_, i) =>
                kind === "sera"
                  ? [4, 9, 11].includes(i)
                  : kind === "digital-passport"
                    ? [3, 7, 8].includes(i)
                    : kind === "security"
                      ? [8, 9].includes(i)
                      : [0, 3, 9, 12].includes(i),
              )
        }
      />
      <CTA
        title={
          kind === "partners"
            ? "Let’s start a worthwhile conversation."
            : "Own smarter. Operate better. Stay ahead."
        }
        lead={
          kind === "partners"
            ? "Discuss your requirements through our existing contact channel."
            : "Give the things that matter an intelligent digital memory."
        }
      />
    </SiteShell>
  );
}
