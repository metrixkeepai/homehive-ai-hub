import { createFileRoute } from "@tanstack/react-router";
import {
  Network,
  ShieldCheck,
  Bot,
  Building,
  KeyRound,
  LineChart,
  Globe,
  FileCheck,
} from "lucide-react";
import {
  SiteShell,
  PageHero,
  FeatureGrid,
  Steps,
  UseCases,
  Checklist,
  FAQ,
  CTA,
  FeedCard,
} from "@/components/hv/Site";

const t = "MatrixKeep Enterprise — agentic asset and renewal intelligence";
const d = "Agentic asset, evidence and renewal intelligence at enterprise scale.";
export const Route = createFileRoute("/enterprise")({
  head: () => ({
    meta: [
      { title: t },
      { name: "description", content: d },
      { property: "og:title", content: t },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Enterprise"
        title="Agentic intelligence,"
        accent="at scale."
        lead={d}
        cta="Start a pilot"
        visual={
          <FeedCard
            title="Agents across 214 sites"
            rows={[
              ["Evidence agent", "18,420 files"],
              ["Renewal agent", "312 flagged"],
              ["Warranty agent", "£1.2m covered"],
              ["Compliance agent", "98.6%"],
              ["Vision agent", "4,110 assets"],
            ]}
          />
        }
      />
      <FeatureGrid
        title="Built for complex organisations."
        lead="Hundreds of sites, thousands of assets, one source of truth."
        items={[
          {
            icon: Building,
            t: "Multi-entity hierarchy",
            d: "Group, region, site and department structures that mirror your organisation.",
          },
          {
            icon: Bot,
            t: "Agentic workflows",
            d: "AI agents that capture, verify, chase and escalate — with people approving key steps.",
          },
          {
            icon: ShieldCheck,
            t: "Governance & audit",
            d: "Full activity history and evidence trails on every record.",
          },
          {
            icon: KeyRound,
            t: "Access control",
            d: "Fine-grained roles per entity and site, with single sign-on planned.",
          },
          {
            icon: LineChart,
            t: "Portfolio insight",
            d: "Renewal exposure, warranty coverage and asset value across the estate.",
          },
          {
            icon: Globe,
            t: "White-label & partners",
            d: "Offer MatrixKeep to your customers under your own brand.",
          },
        ]}
      />
      <Steps
        steps={[
          ["Discovery", "We map your sites, asset classes and renewal obligations."],
          ["Pilot", "Run MatrixKeep on a set of sites with your team."],
          ["Roll out", "Scale across the estate with onboarding and support."],
        ]}
      />
      <UseCases
        title="For organisations like"
        items={[
          "Retail chains",
          "Healthcare groups",
          "Multi-academy trusts",
          "Facilities management",
          "Property portfolios",
          "Insurers & brokers",
          "Logistics",
          "Hotel groups",
          "Local government",
        ]}
      />
      <Checklist
        title="Enterprise-ready from day one."
        items={[
          "Data isolated per workspace",
          "Encrypted, private file storage",
          "Role-based permissions",
          "Dedicated onboarding and success manager",
          "Custom contracts and invoicing",
        ]}
        side={
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                [Network, "Multi-site"],
                [FileCheck, "Audit trail"],
                [Bot, "AI agents"],
                [ShieldCheck, "Security reviews"],
              ] as const
            ).map(([I, l]) => (
              <div key={l} className="rounded-3xl border bg-card p-6 shadow-soft">
                <I className="h-6 w-6 text-primary" />
                <p className="mt-4 font-semibold">{l}</p>
              </div>
            ))}
          </div>
        }
      />
      <FAQ
        items={[
          [
            "How is Enterprise priced?",
            "Pricing is tailored to your number of sites and assets. Contact us for a quote.",
          ],
          ["Can we run a pilot first?", "Yes — we recommend a pilot on a handful of sites."],
          [
            "Do you support single sign-on?",
            "Single sign-on is on our roadmap for Enterprise customers.",
          ],
          ["Can we white-label MatrixKeep?", "Yes, through our White-label plan."],
        ]}
      />
      <CTA
        title="Let’s scope your rollout."
        lead="Tell us about your organisation and we’ll design a pilot."
      />
    </SiteShell>
  );
}
