import { createFileRoute } from "@tanstack/react-router";
import { Heart, Sparkles, Shield } from "lucide-react";
import { SiteShell, PageHero, FeatureGrid, CTA, Reveal } from "@/components/hv/Site";

const t = "About — MatrixKeep";
const d = "We’re building the AI Digital Passport for everything people and organisations own.";
export const Route = createFileRoute("/about")({
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
  component: () => (
    <SiteShell>
      <PageHero eyebrow="About us" title="Keep what matters." accent="Know what’s next." lead={d} />
      <section className="mx-auto max-w-3xl px-6 py-24 text-lg leading-relaxed text-muted-foreground">
        <Reveal>
          <p>
            Receipts fade, warranties lapse and renewals sneak up. Most of us keep the things that
            matter in drawers, inboxes and memory — and find out too late.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-6">
            MatrixKeep changes that. Capture something once and our AI organises it, links the
            evidence, and watches the dates that matter — for a single home or a thousand sites.
          </p>
        </Reveal>
      </section>
      <FeatureGrid
        title="What we believe."
        items={[
          {
            icon: Sparkles,
            t: "Effortless capture",
            d: "If it takes more than a photo, it’s too much work.",
          },
          {
            icon: Shield,
            t: "Privacy first",
            d: "Your records are yours. We never sell your data.",
          },
          { icon: Heart, t: "Calm, not cluttered", d: "Fewer dashboards, more clear next steps." },
        ]}
      />
      <CTA title="Join us." lead="Start free and see what MatrixKeep remembers for you." />
    </SiteShell>
  ),
});
