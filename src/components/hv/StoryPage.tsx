import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { SiteShell, PageHero, Steps, Checklist, CTA, FeedCard, Reveal } from "@/components/hv/Site";
import { MeetSera } from "@/components/hv/MeetSera";
import type { Story } from "@/components/hv/siteContent";

export function StoryPage({ s, kind, others }: { s: Story; kind: "industries" | "use-cases"; others: Story[] }) {
  return (
    <SiteShell>
      <PageHero eyebrow={kind === "industries" ? "Industry" : "Use case"} title={s.t} lead={s.lead} visual={<FeedCard title={s.t} rows={s.feed} />} />
      <section className="mx-auto max-w-7xl px-6 py-24">
        <Reveal><h2 className="font-display text-4xl font-medium tracking-tight">The problem today</h2></Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {s.pains.map((p, i) => (
            <Reveal key={p} delay={i * 90}>
              <div className="h-full rounded-3xl border bg-card p-7 shadow-soft"><X className="h-5 w-5 text-destructive" /><p className="mt-4 font-semibold">{p}</p></div>
            </Reveal>
          ))}
        </div>
      </section>
      <Steps steps={s.steps} />
      <Checklist title="What MatrixKeep tracks" items={s.tracks} side={<FeedCard title="Live in MatrixKeep" rows={s.feed} />} />
      <MeetSera />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="font-display text-3xl font-medium">Explore more</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {others.filter((o) => o.slug !== s.slug).slice(0, 3).map((o) => (
            <Link key={o.slug} to={kind === "industries" ? "/industries/$slug" : "/use-cases/$slug"} params={{ slug: o.slug }} className="rounded-3xl border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
              <o.icon className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">{o.t}</p><p className="mt-1 text-sm text-muted-foreground">{o.short}</p>
            </Link>
          ))}
        </div>
      </section>
      <CTA title={`Start with ${s.t.toLowerCase()} today.`} lead="Capture it once. MatrixKeep remembers what happens next." />
    </SiteShell>
  );
}

export function StoryIndex({ title, lead, items, kind }: { title: string; lead: string; items: Story[]; kind: "industries" | "use-cases" }) {
  return (
    <SiteShell>
      <PageHero eyebrow={kind === "industries" ? "Industries" : "Use cases"} title={title} lead={lead} />
      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-24 md:grid-cols-2 lg:grid-cols-4">
        {items.map((o, i) => (
          <Reveal key={o.slug} delay={i * 60}>
            <Link to={kind === "industries" ? "/industries/$slug" : "/use-cases/$slug"} params={{ slug: o.slug }} className="group block h-full rounded-3xl border bg-card p-7 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary transition group-hover:bg-aurora"><o.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground" /></span>
              <h3 className="mt-5 font-semibold">{o.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{o.short}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-primary transition group-hover:translate-x-1">Explore →</span>
            </Link>
          </Reveal>
        ))}
      </section>
      <CTA title="Don't see yours?" lead="MatrixKeep works for anything you own, operate or need to remember. Tell us what you need." />
    </SiteShell>
  );
}
