import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteShell, Steps, FAQ, CTA, FeedCard, Reveal } from "./Site";
import type { Story } from "./siteContent";
import { storyPhoto, photos } from "@/components/marketing/media";
import { SeraDemo } from "@/components/marketing/Demos";
export function StoryPage({
  s,
  kind,
  others,
}: {
  s: Story;
  kind: "industries" | "use-cases";
  others: Story[];
}) {
  return (
    <SiteShell>
      <section className="mk-page-hero">
        <img
          src={storyPhoto(s.slug)}
          alt={`${s.t} environment and assets`}
          width="627"
          height="627"
          className="mk-hero-photo"
          fetchPriority="high"
        />
        <div className="mk-hero-shade" />
        <div className="mk-container relative">
          <div className="mk-hero-copy">
            <p className="mk-eyebrow">
              {kind === "industries" ? "Industry solution" : "A real-world use case"} · MatrixKeep
            </p>
            <h1>{s.t}</h1>
            <p className="mk-lead">{s.lead}</p>
            <div className="mk-actions">
              <Button asChild>
                <Link to={kind === "industries" ? "/pricing" : "/auth"}>
                  {kind === "industries" ? "Explore Business Plans" : "Start Free"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/contact">Discuss your needs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mk-container mk-section mk-split">
        <div>
          <p className="mk-eyebrow">The challenge</p>
          <h2>
            The information exists.
            <br />
            Finding it is the hard part.
          </h2>
          <div className="mk-problem-list">
            {s.pains.map((p) => (
              <article key={p}>
                <FileText />
                <div>
                  <h3>{p}</h3>
                  <p>
                    Connect the relevant records and supporting evidence rather than relying on
                    memory.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <img
          src={kind === "industries" ? storyPhoto(s.slug) : photos.it}
          alt={`${s.t} records and equipment`}
          width="627"
          height="627"
          loading="lazy"
        />
      </section>
      <Steps steps={s.steps} />
      <section className="mk-container mk-section mk-split">
        <div>
          <p className="mk-eyebrow">The MatrixKeep approach</p>
          <h2>
            Useful details.
            <br />
            Connected to the right place.
          </h2>
          <ul className="mk-checklist">
            {s.tracks.map((t) => (
              <li key={t}>
                <Check className="size-4 text-primary" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mk-disclaimer">
            Capabilities and capacities depend on your plan. Saved records support human review;
            they do not certify compliance, guarantee claim acceptance or provide professional
            valuations.
          </p>
        </div>
        <FeedCard title={`Example ${s.t.toLowerCase()} records`} rows={s.feed} />
      </section>
      <SeraDemo initial={kind === "industries" ? "business" : "personal"} />
      <FAQ
        items={[
          [
            `How does MatrixKeep help with ${s.t.toLowerCase()}?`,
            s.short +
              " Save relevant records, connect their evidence and review important dates in the existing workspace.",
          ],
          [
            "Can I check the original evidence?",
            "Keep and review supporting documents with the record. AI-extracted information should be checked against the source before saving or acting.",
          ],
          [
            "Does this replace specialist advice?",
            "No. Professional inspections, compliance assessments, insurance decisions and valuations remain with the appropriate qualified people.",
          ],
        ]}
      />
      <section className="mk-container mk-section">
        <p className="mk-eyebrow">Keep exploring</p>
        <h2>Connected needs. Connected solutions.</h2>
        <div className="mk-use-grid mt-8">
          {others
            .filter((o) => o.slug !== s.slug)
            .slice(0, 3)
            .map((o) => (
              <Link
                key={o.slug}
                className="mk-use-card"
                to={kind === "industries" ? "/industries/$slug" : "/use-cases/$slug"}
                params={{ slug: o.slug }}
              >
                <img
                  src={storyPhoto(o.slug)}
                  alt={o.t + " example"}
                  width="627"
                  height="627"
                  loading="lazy"
                />
                <div>
                  <h3>{o.t}</h3>
                  <p>{o.short}</p>
                  <span>
                    Explore
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            ))}
        </div>
      </section>
      <CTA
        title="Put the information where it belongs."
        lead={`Start building a connected digital memory for ${s.t.toLowerCase()}.`}
      />
    </SiteShell>
  );
}
export function StoryIndex({
  title,
  lead,
  items,
  kind,
}: {
  title: string;
  lead: string;
  items: Story[];
  kind: "industries" | "use-cases";
}) {
  return (
    <SiteShell>
      <section className="mk-page-hero">
        <img
          src={kind === "industries" ? photos.cafe : photos.family}
          alt={
            kind === "industries"
              ? "Independent business with equipment"
              : "Family managing household information"
          }
          className="mk-hero-photo"
          width="429"
          height="407"
          fetchPriority="high"
        />
        <div className="mk-hero-shade" />
        <div className="mk-container relative">
          <div className="mk-hero-copy">
            <p className="mk-eyebrow">
              {kind === "industries" ? "Industry solutions" : "Real-world use cases"}
            </p>
            <h1>{title}</h1>
            <p className="mk-lead">{lead}</p>
            <div className="mk-actions">
              <Button asChild>
                <Link to="/auth">
                  Start Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mk-container mk-section">
        <div className="mk-use-grid">
          {items.map((o) => (
            <Reveal key={o.slug}>
              <Link
                className="mk-use-card block h-full"
                to={kind === "industries" ? "/industries/$slug" : "/use-cases/$slug"}
                params={{ slug: o.slug }}
              >
                <img
                  src={storyPhoto(o.slug)}
                  alt={o.t + " example environment"}
                  width="627"
                  height="627"
                  loading="lazy"
                />
                <div>
                  <h3>{o.t}</h3>
                  <p>{o.short}</p>
                  <span>
                    Explore this {kind === "industries" ? "industry" : "use case"}
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <CTA
        title="A platform built around your world."
        lead="Talk to us about the assets, evidence and important information you need to organise."
      />
    </SiteShell>
  );
}
