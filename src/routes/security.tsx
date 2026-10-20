import { createFileRoute } from "@tanstack/react-router";
import { Lock, KeyRound, EyeOff, Server, Share2, UserCheck } from "lucide-react";
import { SiteShell, PageHero, FeatureGrid, CTA } from "@/components/hv/Site";

const t = "Security & privacy — MatrixKeep";
const d = "Private by design. Your records and files are yours alone.";
export const Route = createFileRoute("/security")({
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
      <PageHero eyebrow="Security" title="Private by design." accent="Yours alone." lead={d} />
      <FeatureGrid
        title="How we protect what you keep."
        items={[
          {
            icon: Lock,
            t: "Encrypted in transit and at rest",
            d: "Your data and files are encrypted when sent and when stored.",
          },
          {
            icon: EyeOff,
            t: "Private file storage",
            d: "Evidence files are never public; only signed-in owners can open them.",
          },
          {
            icon: UserCheck,
            t: "Row-level access",
            d: "Every record is tied to its owner and workspace, enforced by the database.",
          },
          { icon: KeyRound, t: "Secure sign-in", d: "Email confirmation and Google sign-in." },
          {
            icon: Server,
            t: "AI without leaks",
            d: "AI requests run on our servers; keys never reach your browser.",
          },
          {
            icon: Share2,
            t: "Controlled sharing",
            d: "Roles decide who sees what in a household or business.",
          },
        ]}
      />
      <CTA
        title="Questions about security?"
        lead="Our team is happy to walk you through how MatrixKeep keeps your data safe."
      />
    </SiteShell>
  ),
});
