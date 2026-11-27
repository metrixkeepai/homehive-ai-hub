import { EnvironmentExplorer, LivingOverlay } from "./Living";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Package,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
  CalendarClock,
  Camera,
  Car,
  Wrench,
  Link2,
  Eye,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteShell, FeatureGrid, FAQ, CTA, Reveal, FeedCard } from "@/components/hv/Site";
import { photos } from "./media";
import { PassportDemo, SeraDemo, RoiCalculator, MarketingPricing } from "./Demos";
import { Journey, IndustryShowcase, Trust, Intelligence } from "./Sections";
import { commonFaq } from "./content";
const content = {
  individual: {
    eyebrow: "MatrixKeep for Individuals & Families",
    title: "Give everything you’ve worked for an intelligent digital memory.",
    lead: "Your home. Your belongings. Your vehicles. Your important documents. One intelligent digital home for everything you own and everything you need to remember.",
    image: photos.family,
    cta: "Start Free",
    to: "/auth",
    secondary: "See Individual Plans",
    secondTo: "/pricing",
    storyTitle: "You spent years building your life. Give it the protection it deserves.",
    story:
      "Your home is more than a building. Your belongings represent hard work, investments and everyday life. When an appliance breaks or you prepare insurance evidence, the right information should be close at hand.",
    outcome: "Less searching. Less worrying. More living.",
  },
  business: {
    eyebrow: "MatrixKeep for Small & Medium Businesses",
    title: "Run your business. Let MatrixKeep remember the details.",
    lead: "Every piece of equipment. Every invoice. Every warranty. Every contract. Every location. Bring your business knowledge together without the complexity of traditional enterprise software.",
    image: photos.cafe,
    cta: "Explore Business Plans",
    to: "/pricing",
    secondary: "Book a Demo",
    secondTo: "/contact",
    storyTitle: "Your business shouldn’t depend on one person’s memory.",
    story:
      "When the person who knows the equipment history moves on, where are the invoices? Which warranty is still active? When is the next service? Turn fragmented knowledge into structured records your business can work with.",
    outcome: "Build a business that remembers, even when people move on.",
  },
  enterprise: {
    eyebrow: "MatrixKeep Enterprise",
    title: "Enterprise Asset Intelligence. Built for Operational Assurance.",
    lead: "Explore how connected asset records, supporting evidence and lifecycle information can turn fragmented operational knowledge into structured intelligence, with responsible AI and human oversight.",
    image: photos.enterprise,
    cta: "Book an Enterprise Consultation",
    to: "/contact",
    secondary: "Become a Pilot Partner",
    secondTo: "/partners",
    storyTitle: "Greater visibility begins with better-connected evidence.",
    story:
      "Complex organisations need to understand what information they hold, where it belongs and who needs to review it. Discuss your locations, equipment, evidence requirements and integration needs with the MatrixKeep team.",
    outcome: "Practical use cases. Clear scope. Responsible deployment.",
  },
} as const;
export function AudiencePage({ audience }: { audience: keyof typeof content }) {
  const c = content[audience];
  const enterprise = audience === "enterprise";
  const business = audience === "business";
  const features =
    audience === "individual"
      ? [
          {
            icon: Camera,
            t: "Capture your belongings",
            d: "Use supported photo, receipt, document and voice capture, then review the extracted details.",
          },
          {
            icon: ShieldCheck,
            t: "Keep warranty evidence",
            d: "Connect cover dates to the purchase receipt instead of searching when something breaks.",
          },
          {
            icon: Car,
            t: "Remember your vehicles",
            d: "Keep vehicle records, insurance, MOT dates and service evidence together.",
          },
          {
            icon: MapPin,
            t: "Organise your properties",
            d: "Link rooms, assets and documents to the correct property within your plan allowance.",
          },
          {
            icon: Wrench,
            t: "Keep maintenance history",
            d: "Save service records and review the dates you have recorded.",
          },
          {
            icon: FileText,
            t: "Prepare evidence with context",
            d: "Photos, receipts and serial numbers help you prepare for moving, repairs and insurer requests.",
          },
        ]
      : [
          {
            icon: Package,
            t: "Business asset intelligence",
            d: "Keep equipment identity, recorded purchase value, location and supporting information connected.",
          },
          {
            icon: MapPin,
            t: "Multi-location visibility",
            d: "Organise records by business location and workspace, within your plan allowance.",
          },
          {
            icon: ShieldCheck,
            t: "Warranties & renewals",
            d: "Review recorded cover, contracts, insurance and notice deadlines in context.",
          },
          {
            icon: FileText,
            t: "Evidence management",
            d: "Save supplier invoices, manuals, service reports and certificates with the right assets.",
          },
          {
            icon: Users,
            t: "Recorded team responsibilities",
            d: "Keep team information and responsibilities organised. Discuss access requirements before an enterprise deployment.",
          },
          {
            icon: CalendarClock,
            t: "Operational obligations",
            d: "Review maintenance, renewal and inspection dates. Qualified professionals remain responsible for compliance decisions.",
          },
        ];
  return (
    <SiteShell>
      <section className="mk-page-hero">
        <img
          src={c.image}
          alt={
            audience === "individual"
              ? "Family at home organising important information"
              : business
                ? "Café owner managing commercial equipment"
                : "Business operations team collaborating"
          }
          width="429"
          height="407"
          className="mk-hero-photo"
          fetchPriority="high"
        />
        <div className="mk-hero-shade" />
        <div className="mk-container relative">
          <div className="mk-hero-copy">
            <p className="mk-eyebrow">{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <p className="mk-lead">{c.lead}</p>
            <div className="mk-actions">
              <Button asChild>
                <Link to={c.to}>
                  {c.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={c.secondTo}>{c.secondary}</Link>
              </Button>
            </div>
          </div>
        </div>
        <LivingOverlay label={enterprise ? "Connected enterprise locations" : business ? "Business equipment passport" : "Your digital home"} />
      </section>
      {!enterprise && <EnvironmentExplorer personal={!business} />}
      <section className="mk-container mk-section mk-split">
        <Reveal>
          <p className="mk-eyebrow">Built around what matters to you</p>
          <h2>{c.storyTitle}</h2>
          <p className="mk-lead">{c.story}</p>
          <p className="mt-6 text-primary font-semibold text-sm">{c.outcome}</p>
        </Reveal>
        <img
          src={
            audience === "individual" ? photos.appliance : business ? photos.it : photos.warehouse
          }
          alt={
            audience === "individual"
              ? "A household appliance with its purchase evidence"
              : business
                ? "Business workstation and invoices"
                : "Warehouse equipment and operational records"
          }
          width="627"
          height="627"
          loading="lazy"
        />
      </section>
      <FeatureGrid
        title={
          enterprise
            ? "A platform foundation. An assurance roadmap."
            : business
              ? "Run operations, not spreadsheets."
              : "Your everyday life, better connected."
        }
        items={features}
      />
      {enterprise ? (
        <>
          <section className="mk-tint">
            <div className="mk-container mk-section">
              <p className="mk-eyebrow">Platform foundation · Available capabilities</p>
              <h2>
                Evidence at the centre.
                <br />
                People in control.
              </h2>
              <div className="mk-flow">
                {[
                  { icon: Package, t: "Asset records" },
                  { icon: FileText, t: "Supporting evidence" },
                  { icon: Link2, t: "Connected passports" },
                  { icon: CalendarClock, t: "Saved obligations" },
                  { icon: Brain, t: "AI-assisted interpretation" },
                  { icon: Eye, t: "Human review" },
                ].map((f) => (
                  <div key={f.t}>
                    <f.icon className="size-6" />
                    <strong>{f.t}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <Intelligence />
          <section className="mk-container mk-section mk-split">
            <div>
              <p className="mk-eyebrow">Pilot & strategic partnerships</p>
              <h2>Help shape the future of intelligent asset assurance.</h2>
              <p className="mk-lead">
                Explore multimodal evidence verification, compliance gap identification, risk
                assessment and human-supervised corrective workflows. These advanced capabilities
                are roadmap areas, not claims of current deployment.
              </p>
              <div className="mk-actions">
                <Button asChild>
                  <Link to="/partners">
                    Become a Pilot Partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <FeedCard
              title="A scoped enterprise conversation"
              rows={[
                ["Discovery", "Use cases & asset classes"],
                ["Feasibility", "Access & integration review"],
                ["Pilot scope", "Agreed requirements"],
                ["Evaluation", "Human-reviewed outcomes"],
              ]}
            />
          </section>
        </>
      ) : (
        <>
          <PassportDemo personal={!business} />
          <SeraDemo initial={business ? "business" : "personal"} />
          <Journey />
          {business && (
            <>
              <IndustryShowcase />
              <RoiCalculator />
            </>
          )}
        </>
      )}
      <MarketingPricing initial={audience} />
      <Trust />
      <FAQ
        items={
          enterprise
            ? [
                commonFaq[9],
                commonFaq[14],
                [
                  "Are integrations and enterprise deployments already included?",
                  "Integration, licensing and deployment requirements are discussed and scoped with your organisation; do not assume a custom rollout or advanced assurance is included.",
                ],
                [
                  "Is SSO available?",
                  "Enterprise access requirements, including single sign-on, must be reviewed with the team. This website does not claim an already deployed enterprise SSO offering.",
                ],
              ].filter((x): x is [string, string] => Boolean(x))
            : commonFaq.filter((_, i) =>
                business
                  ? [1, 2, 6, 7, 10, 11, 13].includes(i)
                  : [2, 3, 4, 5, 6, 7, 11, 12].includes(i),
              )
        }
      />
      <CTA
        title={
          enterprise
            ? "Let’s explore your operational requirements."
            : business
              ? "Your business. With a better memory."
              : "Remember the things that matter. Enjoy everything else."
        }
        lead={c.outcome}
      />
    </SiteShell>
  );
}
