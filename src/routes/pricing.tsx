import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell, PageHero, FAQ, CTA, Reveal } from "@/components/hv/Site";
import { plans, type Audience } from "@/lib/plans";
import { PlanCard, BillingToggle, CompareTable } from "@/components/hv/PlanCard";

const t = "Pricing — MatrixKeep";
const d = "Plans for homes, businesses and enterprises with clear users, assets, storage and AI allowances. Start free, or try Business Starter free for 14 days.";
export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

const tabs: [Audience, string][] = [["individual", "Individual"], ["business", "Business"], ["enterprise", "Enterprise & White-label"]];

function Page() {
  const [tab, setTab] = useState<Audience>("individual");
  const [yearly, setYearly] = useState(false);
  const list = plans.filter((p) => p.audience === tab);
  return (
    <SiteShell>
      <PageHero eyebrow="Pricing" title="Know exactly what you get." accent="Start free." lead={d} />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-xl gap-1 overflow-x-auto rounded-full border bg-card p-1">
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-aurora text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>{l}</button>)}
        </div>
        {tab !== "enterprise" && <div className="mt-4"><BillingToggle yearly={yearly} onChange={setYearly} /></div>}
        <div key={tab} className={`mt-12 grid gap-6 md:grid-cols-2 ${list.length > 2 ? "xl:grid-cols-4" : "mx-auto max-w-4xl"}`}>
          {list.map((p, i) => (
            <Reveal key={p.key} delay={i * 80}>
              <PlanCard p={p} yearly={yearly} highlight={p.badge === "Most popular" || (tab === "enterprise" && i === 0)} cta={
                <>
                  <Link to={p.monthly === null ? "/contact" : "/auth"} className="block rounded-full bg-aurora py-2.5 text-center text-sm font-semibold text-primary-foreground">
                    {p.monthly === null ? (p.key === "whitelabel" ? "Discuss White-label" : "Contact Enterprise") : p.trialDays ? "Start 14-day free trial" : p.monthly === 0 ? "Start free" : `Choose ${p.name}`}
                  </Link>
                  {p.trialDays && <p className="text-center text-xs opacity-70">No card needed to start the trial</p>}
                </>
              } />
            </Reveal>
          ))}
        </div>
        <div className="mt-16"><h2 className="mb-6 text-center font-display text-3xl">Side-by-side comparison</h2><CompareTable list={list} /></div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Prices in GBP. Only Business Starter includes a free trial. Have a voucher? Redeem it after sign-up on the Plans page.</p>
      </section>
      <FAQ items={[
        ["Can I change plan later?", "Yes. Upgrades and downgrades are made from Plans inside your account, and your limits update straight away."],
        ["What happens when the Business Starter trial ends?", "You can continue on Business Starter or upgrade. If you take no action, your workspace becomes read-only — your data is never deleted."],
        ["What counts as an AI capture?", "Each photo, receipt, room scan, voice note or email that MatrixKeep reads to create records counts as one capture."],
        ["Do you offer vouchers?", "Yes — enter a voucher code on the Plans page once you've signed up."],
        ["Is there a contract?", "Monthly plans can be cancelled any time. Enterprise and White-label contracts are tailored."],
      ]} />
      <CTA title="Start free today." lead="Upgrade only when you need more." />
    </SiteShell>
  );
}
