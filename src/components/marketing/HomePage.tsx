import { CinematicHero } from "./Living";
import { PassportBirth, StoryBridge } from "./PassportBirth";
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
      <PassportBirth />
      <StoryBridge>Life is complicated enough. Managing it shouldn't be.</StoryBridge>
      <Problems />
      <StoryBridge>Less searching. More knowing.</StoryBridge>
      <Worlds />
      <Capabilities />
      <StoryBridge>Every asset deserves a memory.</StoryBridge>
      <PassportDemo />
      <StoryBridge>Don't search for answers. Ask for them.</StoryBridge>
      <SeraDemo />
      <StoryBridge>Intelligence that connects the dots.</StoryBridge>
      <Intelligence />
      <Journey />
      <UseCaseExplorer />
      <IndustryShowcase />
      <StoryBridge>From one asset to your entire operation.</StoryBridge>
      <RoiCalculator />
      <Comparison />
      <StoryBridge>Powerful intelligence. Simple pricing.</StoryBridge>
      <MarketingPricing />
      <Trust />
      <FAQ items={commonFaq} />
      <StoryBridge>Your next step towards a smarter life and business.</StoryBridge>
      <CTA
        title="Your life. Your business. Your intelligence."
        lead="Stop letting important information disappear into emails, spreadsheets and forgotten folders. Give everything you own and operate an intelligent digital memory."
      />
    </SiteShell>
  );
}
