import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { Menu, X, ChevronDown, Check, ArrowRight, FileCheck2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { industries, useCases } from "./siteContent";
import { photos } from "@/components/marketing/media";

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
type PublicPath =
  | "/"
  | "/features"
  | "/ai-agents"
  | "/sera"
  | "/digital-passport"
  | "/security"
  | "/individual"
  | "/business"
  | "/enterprise"
  | "/partners"
  | "/how-it-works"
  | "/pricing"
  | "/about"
  | "/contact"
  | "/privacy"
  | "/terms"
  | "/industries"
  | "/use-cases"
  | "/auth";
type Entry = { t: string; to: PublicPath; d?: string };
const menuGroups: { label: string; items: Entry[] }[] = [
  {
    label: "Product",
    items: [
      { t: "Platform overview", to: "/features", d: "Your assets. Connected intelligence." },
      { t: "AI Agents", to: "/ai-agents", d: "Capture, understand and connect." },
      { t: "Meet Sera", to: "/sera", d: "Answers from your saved records." },
      {
        t: "Digital Asset Passport",
        to: "/digital-passport",
        d: "A digital identity for every asset.",
      },
      { t: "Security & Privacy", to: "/security", d: "Information under your control." },
    ],
  },
  {
    label: "Solutions",
    items: [
      { t: "Individuals & Families", to: "/individual", d: "Less searching. More living." },
      { t: "Small & Medium Businesses", to: "/business", d: "A business that remembers." },
      { t: "Enterprise", to: "/enterprise", d: "Explore operational assurance." },
      { t: "Partners", to: "/partners", d: "Build what comes next, together." },
    ],
  },
  {
    label: "Company",
    items: [
      { t: "About MatrixKeep", to: "/about" },
      { t: "Contact", to: "/contact" },
      { t: "Book a Demo", to: "/contact" },
      { t: "Become a Pilot Partner", to: "/partners" },
    ],
  },
];
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setMenu(null);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const group = menuGroups.find((m) => m.label === menu);
  return (
    <header className="mk-header" onMouseLeave={() => setMenu(null)}>
      <div className="mk-nav">
        <Logo />
        <nav aria-label="Main navigation" className="mk-desktop-nav">
          <Link to="/" onMouseEnter={() => setMenu(null)}>
            Home
          </Link>
          {menuGroups.slice(0, 2).map((m) => (
            <Button
              key={m.label}
              variant="ghost"
              size="sm"
              onMouseEnter={() => setMenu(m.label)}
              onClick={() => setMenu(menu === m.label ? null : m.label)}
              aria-expanded={menu === m.label}
              aria-controls="marketing-menu"
            >
              {m.label}
              <ChevronDown className="size-3" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onMouseEnter={() => setMenu("Use Cases")}
            onClick={() => setMenu(menu === "Use Cases" ? null : "Use Cases")}
            aria-expanded={menu === "Use Cases"}
          >
            Use Cases
            <ChevronDown className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onMouseEnter={() => setMenu("Industries")}
            onClick={() => setMenu(menu === "Industries" ? null : "Industries")}
            aria-expanded={menu === "Industries"}
          >
            Industries
            <ChevronDown className="size-3" />
          </Button>
          <Link to="/how-it-works" onMouseEnter={() => setMenu(null)}>
            How It Works
          </Link>
          <Link to="/pricing" onMouseEnter={() => setMenu(null)}>
            Pricing
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onMouseEnter={() => setMenu("Company")}
            onClick={() => setMenu(menu === "Company" ? null : "Company")}
            aria-expanded={menu === "Company"}
          >
            Company
            <ChevronDown className="size-3" />
          </Button>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">
              Start Free
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="mk-mobile-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {menu && (
        <div id="marketing-menu" className="mk-mega">
          <div className="mk-mega-inner">
            <div className="mk-mega-links">
              {group?.items.map((m) => (
                <Link key={m.t} to={m.to} onClick={close}>
                  <span>{m.t}</span>
                  {m.d && <small>{m.d}</small>}
                  <ArrowRight className="size-4" />
                </Link>
              ))}
              {menu === "Industries" &&
                industries.map((m) => (
                  <Link
                    key={m.slug}
                    to="/industries/$slug"
                    params={{ slug: m.slug }}
                    onClick={close}
                  >
                    <span>{m.t}</span>
                    <small>{m.short}</small>
                  </Link>
                ))}
              {menu === "Use Cases" &&
                useCases.map((m) => (
                  <Link
                    key={m.slug}
                    to="/use-cases/$slug"
                    params={{ slug: m.slug }}
                    onClick={close}
                  >
                    <span>{m.t}</span>
                    <small>{m.short}</small>
                  </Link>
                ))}
            </div>
            <Link
              to={menu === "Company" ? "/partners" : "/digital-passport"}
              onClick={close}
              className="mk-mega-feature"
            >
              <img src={photos.coffee} alt="Commercial coffee machine" width="627" height="627" />
              <span>One asset. Its whole story.</span>
              <small>Explore Digital Passports →</small>
            </Link>
          </div>
        </div>
      )}
      {open && (
        <nav aria-label="Mobile navigation" className="mk-mobile-nav">
          <Link to="/" onClick={close}>
            Home
          </Link>
          {menuGroups.map((m) => (
            <details key={m.label}>
              <summary>{m.label}</summary>
              {m.items.map((x) => (
                <Link key={x.t} to={x.to} onClick={close}>
                  {x.t}
                </Link>
              ))}
            </details>
          ))}
          <details>
            <summary>Use Cases</summary>
            {useCases.map((x) => (
              <Link key={x.slug} to="/use-cases/$slug" params={{ slug: x.slug }} onClick={close}>
                {x.t}
              </Link>
            ))}
          </details>
          <details>
            <summary>Industries</summary>
            {industries.map((x) => (
              <Link key={x.slug} to="/industries/$slug" params={{ slug: x.slug }} onClick={close}>
                {x.t}
              </Link>
            ))}
          </details>
          <Link to="/how-it-works" onClick={close}>
            How It Works
          </Link>
          <Link to="/pricing" onClick={close}>
            Pricing
          </Link>
          <Link to="/auth" onClick={close}>
            Sign In
          </Link>
        </nav>
      )}
    </header>
  );
}
export function SiteFooter() {
  const groups: { title: string; items: Entry[] }[] = [
    { title: "Product", items: menuGroups[0]?.items ?? [] },
    { title: "Solutions", items: menuGroups[1]?.items ?? [] },
    {
      title: "Company",
      items: [
        { t: "About MatrixKeep", to: "/about" },
        { t: "Contact & demos", to: "/contact" },
        { t: "Pricing", to: "/pricing" },
      ],
    },
    {
      title: "Legal",
      items: [
        { t: "Privacy Policy", to: "/privacy" },
        { t: "Terms & Conditions", to: "/terms" },
        { t: "Security", to: "/security" },
      ],
    },
  ];
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-top">
          <Logo />
          <p>Own smarter. Operate better. Stay ahead.</p>
          <Button asChild variant="outline">
            <Link to="/auth">
              Start Free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mk-footer-grid">
          {groups.map((g) => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              {g.items.map((m) => (
                <Link key={m.t} to={m.to}>
                  {m.t}
                </Link>
              ))}
            </div>
          ))}
          <div>
            <h3>Use Cases</h3>
            {useCases.slice(0, 6).map((m) => (
              <Link key={m.slug} to="/use-cases/$slug" params={{ slug: m.slug }}>
                {m.t}
              </Link>
            ))}
          </div>
          <div>
            <h3>Industries</h3>
            {industries.slice(0, 6).map((m) => (
              <Link key={m.slug} to="/industries/$slug" params={{ slug: m.slug }}>
                {m.t}
              </Link>
            ))}
          </div>
        </div>
        <div className="mk-footer-bottom">
          <span>© 2026 MatrixKeep. All rights reserved.</span>
          <a href="mailto:hello@matrixkeep.com">hello@matrixkeep.com</a>
          <span>Built around what matters.</span>
        </div>
      </div>
    </footer>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
export function PageHero({
  eyebrow,
  title,
  accent,
  lead,
  cta = "Start Free",
  visual,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lead: string;
  cta?: string;
  visual?: ReactNode;
}) {
  const image = /business|enterprise/i.test(eyebrow)
    ? photos.enterprise
    : /industry/i.test(eyebrow)
      ? photos.cafe
      : photos.world;
  return (
    <section className="mk-page-hero">
      <img
        className="mk-hero-photo"
        src={image}
        alt="Contemporary home and business environment"
        width="1536"
        height="1024"
        fetchPriority="high"
      />
      <div className="mk-hero-shade" />
      <div className="mk-container relative">
        <div className="mk-hero-copy">
          <p className="mk-eyebrow">{eyebrow}</p>
          <h1>
            {title}
            {accent && (
              <>
                {" "}
                <em>{accent}</em>
              </>
            )}
          </h1>
          <p className="mk-lead">{lead}</p>
          <div className="mk-actions">
            <Button asChild>
              <Link
                to={
                  cta.toLowerCase().includes("demo") || cta.toLowerCase().includes("talk")
                    ? "/contact"
                    : "/auth"
                }
              >
                {cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
        {visual && <div className="mk-hero-preview">{visual}</div>}
      </div>
    </section>
  );
}
export function FeatureGrid({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: { icon: ComponentType<{ className?: string }>; t: string; d: string }[];
}) {
  return (
    <section className="mk-section mk-container">
      <Reveal>
        <p className="mk-eyebrow">Connected capabilities</p>
        <h2>{title}</h2>
        {lead && <p className="mk-lead">{lead}</p>}
      </Reveal>
      <div className="mk-feature-grid">
        {items.map((f, i) => (
          <Reveal key={f.t} delay={i * 40}>
            <div className="mk-feature">
              <f.icon className="size-6 text-primary" />
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
export function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <section className="mk-tint">
      <div className="mk-container mk-section">
        <div className="mk-steps">
          {steps.map(([t, d], i) => (
            <Reveal key={t} delay={i * 60}>
              <span className="mk-step-number">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
export function UseCases({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mk-container mk-section">
      <h2>{title}</h2>
      <div className="mk-tags">
        {items.map((x) => (
          <span key={x}>
            <Check className="size-4 text-primary" />
            {x}
          </span>
        ))}
      </div>
    </section>
  );
}
export function Checklist({
  title,
  items,
  side,
}: {
  title: string;
  items: string[];
  side: ReactNode;
}) {
  return (
    <section className="mk-container mk-section mk-split">
      <Reveal>
        <h2>{title}</h2>
        <ul className="mk-checklist">
          {items.map((x) => (
            <li key={x}>
              <Check className="size-5 text-primary" />
              {x}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal>{side}</Reveal>
    </section>
  );
}
export function FAQ({ items }: { items: [string, string][] }) {
  return (
    <section className="mk-container mk-section mk-faq">
      <div>
        <p className="mk-eyebrow">A little clarity</p>
        <h2>
          Questions,
          <br />
          answered.
        </h2>
        <p>Still have something on your mind?</p>
        <Button asChild variant="link">
          <Link to="/contact">
            Talk to the team
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div>
        {items.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <ChevronDown className="size-4 shrink-0" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
export function CTA({ title, lead }: { title: string; lead: string }) {
  return (
    <section className="mk-final">
      <img
        src={photos.world}
        loading="lazy"
        alt="A home and a business connected by everyday information"
        width="1536"
        height="1024"
      />
      <div className="mk-container">
        <Reveal>
          <p className="mk-eyebrow">Make room for what matters</p>
          <h2>{title}</h2>
          <p className="mk-lead">{lead}</p>
          <div className="mk-actions">
            <Button asChild>
              <Link to="/auth">
                Start Your Free Account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/business">Explore Business</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/contact">Talk to Our Team</Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Own smarter. Operate better. Stay ahead.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
export function FeedCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="mk-feed">
      <div className="mk-feed-head">
        <FileCheck2 className="size-5 text-primary" />
        <strong>{title}</strong>
        <Sparkles className="size-4 text-primary" />
      </div>
      <p className="mk-demo-label">Illustrative product preview</p>
      {rows.map(([a, b]) => (
        <div className="mk-feed-row" key={a}>
          <span>{a}</span>
          <strong>{b}</strong>
        </div>
      ))}
    </div>
  );
}
