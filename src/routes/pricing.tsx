import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { SiteShell, PageHero, FAQ, CTA, Reveal } from "@/components/hv/Site";

const t = "Pricing — MatrixKeep";
const d = "Simple plans for homes, businesses and enterprises. Start free.";
export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

type P = { n: string; p: string; d: string; f: string[]; hi?: boolean };
const tiers = {
  Individual: [
    { n: "Free", p: "£0", d: "Get started with one home", f: ["50 items", "Basic AI capture", "1 member"] },
    { n: "Home", p: "£4.99", d: "Your whole home, organised", f: ["Unlimited items", "All AI agents", "Email import", "2 members"], hi: true },
    { n: "Home+", p: "£9.99", d: "Property & vehicles too", f: ["Everything in Home", "Property passport", "Vehicles", "Claim packs"] },
    { n: "Family", p: "£14.99", d: "Built for the household", f: ["Everything in Home+", "6 members & roles", "Shared tasks", "Priority support"] },
  ],
  Business: [
    { n: "Business", p: "£29", d: "For a single-site business", f: ["Unlimited assets", "Locations", "Team & roles", "Renewal radar"], hi: true },
    { n: "Business Pro", p: "£79", d: "Multi-site operations", f: ["Everything in Business", "Unlimited locations", "Fleet", "Priority support"] },
  ],
  Enterprise: [
    { n: "Enterprise", p: "Custom", d: "Organisations at scale", f: ["Multi-entity hierarchy", "Agentic workflows", "Dedicated success manager", "Custom contracts"], hi: true },
    { n: "White-label", p: "Custom", d: "Offer MatrixKeep under your brand", f: ["Your branding & domain", "Customer licensing", "Partner dashboard"] },
  ],
} satisfies Record<string, P[]>;

function Page() {
  const [tab, setTab] = useState<keyof typeof tiers>("Individual");
  return (
    <SiteShell>
      <PageHero eyebrow="Pricing" title="Simple pricing." accent="Start free." lead={d} />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto flex w-fit gap-1 rounded-full border bg-card p-1">
          {Object.keys(tiers).map((k) => <button key={k} onClick={() => setTab(k as keyof typeof tiers)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === k ? "bg-aurora text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>{k}</button>)}
        </div>
        <div key={tab} className={`mt-12 grid gap-5 md:grid-cols-2 ${tiers[tab].length > 2 ? "lg:grid-cols-4" : "mx-auto max-w-3xl"}`}>
          {tiers[tab].map((p: P, i: number) => (
            <Reveal key={p.n} delay={i * 80}>
              <div className={`h-full rounded-3xl border p-7 transition hover:-translate-y-1 ${p.hi ? "bg-midnight text-midnight-foreground shadow-glow" : "bg-card shadow-soft"}`}>
                <h3 className="font-semibold">{p.n}</h3>
                <p className={`mt-1 text-sm ${p.hi ? "text-midnight-foreground/70" : "text-muted-foreground"}`}>{p.d}</p>
                <p className="mt-6 font-display text-4xl">{p.p}{p.p !== "Custom" && <span className="text-sm opacity-60">/mo</span>}</p>
                <ul className="mt-6 space-y-2 text-sm">{p.f.map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{x}</li>)}</ul>
                <Link to={p.p === "Custom" ? "/contact" : "/auth"} className={`mt-8 block rounded-full py-2.5 text-center text-sm font-semibold ${p.hi ? "bg-aurora text-primary-foreground" : "border hover:bg-secondary"}`}>{p.p === "Custom" ? "Contact us" : `Choose ${p.n}`}</Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Prices in GBP. Have a voucher code? Redeem it after sign-up on the Plans page.</p>
      </section>
      <FAQ items={[["Can I change plan later?", "Yes, upgrade or downgrade any time from your account."], ["Do you offer vouchers?", "Yes — enter a voucher code on the Plans page once you’ve signed up."], ["Is there a contract?", "Monthly plans can be cancelled any time. Enterprise contracts are tailored."]]} />
      <CTA title="Start free today." lead="Upgrade only when you need more." />
    </SiteShell>
  );
}
