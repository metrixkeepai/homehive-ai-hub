import { createFileRoute } from "@tanstack/react-router";
import { Camera, Brain, IdCard, BellRing, Sparkles, Share2 } from "lucide-react";
import { SiteShell, PageHero, CTA, Reveal, FeedCard } from "@/components/hv/Site";
import { MeetSera } from "@/components/hv/MeetSera";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — MatrixKeep" },
      { name: "description", content: "Capture, understand, passport, monitor, ask Sera, share. See how MatrixKeep turns photos and receipts into living digital passports." },
      { property: "og:title", content: "How MatrixKeep works" },
      { property: "og:description", content: "From one photo to a living digital passport that watches what happens next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const steps = [
  { icon: Camera, t: "Capture", d: "Take a photo, scan a receipt, upload a document, speak or paste an email." },
  { icon: Brain, t: "AI understands", d: "Specialist agents read the item, brand, price, purchase date and warranty length." },
  { icon: IdCard, t: "Digital Passport", d: "Everything links into one passport: photos, receipts, documents, room or location." },
  { icon: BellRing, t: "Monitor", d: "Warranty and renewal dates are calculated and turned into reminders you can add to your calendar." },
  { icon: Sparkles, t: "Ask Sera", d: "Ask anything about your records in plain words and get a clear next step." },
  { icon: Share2, t: "Share or transfer", d: "Share evidence for a claim, or hand a passport to the next owner." },
];

function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="How it works" title="From one photo to" accent="a living memory." lead="Capture it once. MatrixKeep organises it, remembers it and watches what happens next."
        visual={<FeedCard title="Your TV, step by step" rows={[["Photo captured", "Vision Agent"], ["Receipt read", "£1,299 · 12 Mar 2026"], ["Warranty found", "2 years"], ["Expiry calculated", "12 Mar 2028"], ["Reminder set", "30 days before"]]} />} />
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative">
          <div className="absolute bottom-0 left-6 top-0 w-px bg-border" />
          <div className="space-y-10">
            {steps.map((s, i) => (
              <Reveal key={s.t} delay={i * 60}>
                <div className="relative flex gap-6">
                  <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-aurora text-primary-foreground shadow-glow"><s.icon className="h-5 w-5" /></span>
                  <div className="flex-1 rounded-3xl border bg-card p-6 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step {i + 1}</p>
                    <h3 className="mt-1 text-xl font-semibold">{s.t}</h3>
                    <p className="mt-2 text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <MeetSera />
      <CTA title="See it with your own things." lead="Start free and create your first digital passport in under a minute." />
    </SiteShell>
  );
}
