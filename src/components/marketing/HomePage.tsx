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
      <section className="mk-home-hero">
        <img
          src={photos.world}
          alt="A contemporary home and independent café with everyday assets and equipment"
          width="1536"
          height="1024"
          className="mk-hero-photo"
          fetchPriority="high"
        />
        <div className="mk-hero-shade" />
        <div className="mk-container relative">
          <div className="mk-hero-copy">
            <p className="mk-hero-kicker">
              <Sparkles className="size-3.5" />
              ASSET INTELLIGENCE. EVERYDAY PEACE OF MIND.
            </p>
            <h1>
              Everything you own.
              <br />
              Everything you operate.
              <br />
              <em>
                Nothing important
                <br className="hidden sm:block" /> forgotten.
              </em>
            </h1>
            <p className="mk-lead">
              Meet MatrixKeep — the AI-powered platform that brings your assets, receipts,
              warranties, documents, maintenance and renewals together.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              Know what you own. See what needs attention.
              <br />
              Take action before it becomes a problem.
            </p>
            <div className="mk-actions">
              <Button asChild>
                <Link to="/auth">
                  Start Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/business">Explore for Business</Link>
              </Button>
            </div>
            <Button asChild variant="link" className="mt-4 pl-0!">
              <Link to="/how-it-works">
                See How It Works
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-[10px] text-muted-foreground mt-4">
              Built for individuals, families, businesses and enterprises.
            </p>
          </div>
          <div className="mk-hero-product">
            <FeedCard
              title="Everything, in perspective"
              rows={[
                ["Washing machine", "Receipt connected"],
                ["Coffee machine", "Service recorded"],
                ["Family vehicle", "Insurance saved"],
                ["Business equipment", "Passport ready"],
              ]}
            />
          </div>
          <div className="mk-hero-alert">
            <div className="mk-float-note">
              <ShieldCheck className="size-6 text-primary shrink-0" />
              <div>
                <strong>A little notice. A lot less worry.</strong>
                <p>Dishwasher warranty · Review before 30 Nov</p>
                <p>Illustrative product preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>
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
