import { CinematicHero } from "./Living";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Check, FileCheck2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteShell, FAQ, CTA, FeedCard } from "@/components/hv/Site";
import { photos } from "./media";
import { commonFaq } from "./content";
import { PassportDemo, SeraDemo, RoiCalculator, MarketingPricing } from "./Demos";
import {
  Problems,
  Worlds,
  Capabilities,
  Intelligence,
  Journey,
  UseCaseExplorer,
  IndustryShowcase,
  Comparison,
  Trust,
} from "./Sections";
export function HomePage() {
  return (
    <SiteShell>
      <CinematicHero />
      <section className="mk-audience-strip">
        <div className="mk-container">
          <strong>A digital memory for your world.</strong>
          <span>Homes & Families</span>
          <span>Independent Businesses</span>
          <span>Multi-location Teams</span>
          <span>Enterprise Opportunities</span>
        </div>
      </section>
      <Problems />
      <Worlds />
      <Capabilities />
      <PassportDemo />
      <SeraDemo />
      <Intelligence />
      <Journey />
      <UseCaseExplorer />
      <IndustryShowcase />
      <RoiCalculator />
      <Comparison />
      <MarketingPricing />
      <Trust />
      <FAQ items={commonFaq} />
      <CTA
        title="Your life. Your business. Your intelligence."
        lead="Stop letting important information disappear into emails, spreadsheets and forgotten folders. Give everything you own and operate an intelligent digital memory."
      />
    </SiteShell>
  );
}
