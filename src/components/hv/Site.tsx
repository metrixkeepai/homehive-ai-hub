import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import {
  Menu,
  X,
  ChevronDown,
  Check,
  ArrowRight,
  Home,
  Building2,
  Landmark,
  Sparkles,
  Workflow,
  Lock,
  Tag,
} from "lucide-react";
import { industries, useCases } from "@/components/hv/siteContent";
import { Logo } from "@/components/hv/Logo";

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
      ([e]) => {
        if (e?.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
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

type MenuItem = {
  to: string;
  params?: { slug: string };
  t: string;
  d: string;
  icon: ComponentType<{ className?: string }>;
};
const menus: {
  label: string;
  all?: { to: string; t: string };
  items: MenuItem[];
  promo: [string, string, string];
}[] = [
  {
    label: "Product",
    items: [
      {
        to: "/features",
        t: "Features",
        d: "Capture, passports, agents and evidence",
        icon: Sparkles,
      },
      {
        to: "/how-it-works",
        t: "How it works",
        d: "From one photo to a living memory",
        icon: Workflow,
      },
      { to: "/security", t: "Security", d: "Private by design", icon: Lock },
      { to: "/pricing", t: "Pricing", d: "Plans for every need", icon: Tag },
    ],
    promo: ["Meet Sera", "Your AI keeper answers from your own records.", "/how-it-works"],
  },
  {
    label: "Solutions",
    items: [
      { to: "/individual", t: "Individual", d: "Homes, belongings, families", icon: Home },
      { to: "/business", t: "Business", d: "SMEs, shops, clinics, offices", icon: Building2 },
      { to: "/enterprise", t: "Enterprise", d: "Multi-site, governance, scale", icon: Landmark },
    ],
    promo: ["Start free", "Create your first Digital Passport in a minute.", "/auth"],
  },
  {
    label: "Use Cases",
    all: { to: "/use-cases", t: "All use cases" },
    items: useCases.map((u) => ({
      to: "/use-cases/$slug",
      params: { slug: u.slug },
      t: u.t,
      d: u.short,
      icon: u.icon,
    })),
    promo: ["Warranty intelligence", "Expiry dates calculated from your receipts.", "/use-cases"],
  },
  {
    label: "Industries",
    all: { to: "/industries", t: "All industries" },
    items: industries.map((u) => ({
      to: "/industries/$slug",
      params: { slug: u.slug },
      t: u.t,
      d: u.short,
      icon: u.icon,
    })),
    promo: ["Multi-location", "Every site, one view.", "/industries"],
  },
];
const links = [
  ["/how-it-works", "How It Works"],
  ["/pricing", "Pricing"],
] as const;

function MenuLink({
  m,
  onClick,
  compact,
}: {
  m: MenuItem;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      to={m.to}
      params={m.params as never}
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-midnight-foreground/5"
    >
      <m.icon className="mt-0.5 h-5 w-5 shrink-0 text-aurora" />
      <span>
        <span className="block text-sm font-semibold">{m.t}</span>
        {!compact && <span className="text-xs text-midnight-foreground/60">{m.d}</span>}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  const lc = "text-sm text-midnight-foreground/70 transition hover:text-midnight-foreground";
  const active = menus.find((m) => m.label === menu);
  const close = () => {
    setMenu(null);
    setOpen(false);
  };
  return (
    <header
      className={`sticky top-0 z-50 text-midnight-foreground transition ${scrolled ? "bg-midnight/90 shadow-soft backdrop-blur" : "bg-midnight"}`}
      onMouseLeave={() => setMenu(null)}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo light />
        <nav className="hidden items-center gap-6 lg:flex">
          {menus.map((m) => (
            <button
              key={m.label}
              onMouseEnter={() => setMenu(m.label)}
              onClick={() => setMenu(menu === m.label ? null : m.label)}
              aria-expanded={menu === m.label}
              className={`${lc} flex items-center gap-1 ${menu === m.label ? "text-midnight-foreground" : ""}`}
            >
              {m.label}{" "}
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${menu === m.label ? "rotate-180" : ""}`}
              />
            </button>
          ))}
          {links.map(([to, t]) => (
            <Link
              key={to}
              to={to}
              onMouseEnter={() => setMenu(null)}
              className={lc}
              activeProps={{ className: "text-midnight-foreground" }}
            >
              {t}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="hidden text-sm text-midnight-foreground/80 hover:text-midnight-foreground sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-midnight-foreground px-5 py-2 text-sm font-semibold text-midnight transition hover:opacity-90"
          >
            Start free
          </Link>
          <button
            aria-label="Open menu"
            className="rounded-full border border-midnight-foreground/20 p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {active && (
        <div className="absolute inset-x-0 top-full hidden lg:block">
          <div className="mx-auto max-w-7xl px-6">
            <div className="animate-rise grid grid-cols-[1fr_260px] gap-4 rounded-3xl border border-midnight-foreground/10 bg-midnight p-4 shadow-glow">
              <div>
                <div
                  className={`grid gap-1 ${active.items.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}
                >
                  {active.items.map((m) => (
                    <MenuLink key={m.t} m={m} onClick={close} />
                  ))}
                </div>
                {active.all && (
                  <Link
                    to={active.all.to}
                    onClick={close}
                    className="ml-3 mt-2 inline-flex items-center gap-1 text-sm font-semibold text-aurora"
                  >
                    {active.all.t} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <Link
                to={active.promo[2]}
                onClick={close}
                className="relative overflow-hidden rounded-2xl bg-midnight-glow p-5"
              >
                <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-aurora opacity-30 blur-2xl animate-float" />
                <Sparkles className="h-5 w-5 text-aurora" />
                <p className="mt-3 font-display text-xl">{active.promo[0]}</p>
                <p className="mt-1 text-sm text-midnight-foreground/70">{active.promo[1]}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-aurora">
                  Explore <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="animate-rise max-h-[80vh] overflow-y-auto border-t border-midnight-foreground/10 px-6 pb-6 lg:hidden">
          {menus.map((m) => (
            <details key={m.label} className="border-b border-midnight-foreground/10 py-2">
              <summary className="cursor-pointer py-2 text-sm font-semibold">{m.label}</summary>
              {m.items.map((x) => (
                <MenuLink key={x.t} m={x} onClick={close} compact />
              ))}
              {m.all && (
                <Link to={m.all.to} onClick={close} className="block p-3 text-sm text-aurora">
                  {m.all.t} →
                </Link>
              )}
            </details>
          ))}
          {links.map(([to, t]) => (
            <Link
              key={to}
              to={to}
              onClick={close}
              className="block py-3 text-sm text-midnight-foreground/80"
            >
              {t}
            </Link>
          ))}
          <Link
            to="/about"
            onClick={close}
            className="block py-3 text-sm text-midnight-foreground/80"
          >
            About
          </Link>
          <Link
            to="/contact"
            onClick={close}
            className="block py-3 text-sm text-midnight-foreground/80"
          >
            Contact
          </Link>
          <Link to="/auth" onClick={close} className="block py-3 text-sm">
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    [
      "Solutions",
      [
        ["/individual", "Individual"],
        ["/business", "Business"],
        ["/enterprise", "Enterprise"],
      ],
    ],
    [
      "Product",
      [
        ["/features", "Features"],
        ["/how-it-works", "How it works"],
        ["/pricing", "Pricing"],
        ["/security", "Security"],
      ],
    ],
    [
      "Explore",
      [
        ["/use-cases", "Use cases"],
        ["/industries", "Industries"],
      ],
    ],
    [
      "Company",
      [
        ["/about", "About"],
        ["/contact", "Contact"],
        ["/auth", "Sign in"],
      ],
    ],
  ];
  return (
    <footer className="bg-midnight text-midnight-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-5">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-midnight-foreground/60">
            Keep what matters. Know what’s next. The AI Digital Passport for everything you own,
            operate and need to remember.
          </p>
        </div>
        {cols.map(([h, ls]) => (
          <div key={h}>
            <p className="text-xs font-semibold uppercase tracking-wider text-midnight-foreground/50">
              {h}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {ls.map(([to, t]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-midnight-foreground/75 hover:text-midnight-foreground"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-midnight-foreground/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-xs text-midnight-foreground/50">
          <p>© 2026 MatrixKeep. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
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
  cta = "Start free",
  visual,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lead: string;
  cta?: string;
  visual?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-midnight-glow text-midnight-foreground">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-aurora opacity-20 blur-3xl animate-float" />
      <div
        className={`relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 ${visual ? "lg:grid-cols-2" : ""}`}
      >
        <div className="animate-rise">
          <span className="inline-flex rounded-full border border-midnight-foreground/15 px-3 py-1 text-xs text-midnight-foreground/80">
            {eyebrow}
          </span>
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            {title} {accent && <em className="text-aurora not-italic">{accent}</em>}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-midnight-foreground/70">{lead}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-aurora px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.03]"
            >
              {cta}
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold transition hover:bg-midnight-foreground/5"
            >
              See pricing
            </Link>
          </div>
        </div>
        {visual && <div className="animate-float">{visual}</div>}
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
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <h2 className="max-w-2xl font-display text-4xl font-medium tracking-tight md:text-5xl">
          {title}
        </h2>
        {lead && <p className="mt-4 max-w-xl text-muted-foreground">{lead}</p>}
      </Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <Reveal key={f.t} delay={i * 70}>
            <div className="group h-full rounded-3xl border bg-card p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-glow">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary transition group-hover:bg-aurora">
                <f.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <section className="border-y bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-3">
        {steps.map(([t, d], i) => (
          <Reveal key={t} delay={i * 100}>
            <span className="font-display text-5xl text-aurora">0{i + 1}</span>
            <h3 className="mt-3 text-xl font-semibold">{t}</h3>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function UseCases({ title, items }: { title: string; items: string[] }) {
  const row = [...items, ...items];
  return (
    <section className="overflow-hidden py-16">
      <Reveal>
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </Reveal>
      <div className="flex w-max animate-marquee gap-3">
        {row.map((x, i) => (
          <span
            key={i}
            className="whitespace-nowrap rounded-full border bg-card px-5 py-2.5 text-sm shadow-soft"
          >
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
    <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
      <Reveal>
        <h2 className="font-display text-4xl font-medium tracking-tight">{title}</h2>
        <ul className="mt-8 space-y-3">
          {items.map((x) => (
            <li key={x} className="flex gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={150}>{side}</Reveal>
    </section>
  );
}

export function FAQ({ items }: { items: [string, string][] }) {
  const [o, setO] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="text-center font-display text-4xl font-medium">Questions, answered</h2>
      <div className="mt-10 divide-y rounded-3xl border bg-card">
        {items.map(([q, a], i) => (
          <div key={q}>
            <button
              onClick={() => setO(o === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold"
              aria-expanded={o === i}
            >
              {q}
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition ${o === i ? "rotate-180" : ""}`}
              />
            </button>
            {o === i && <p className="animate-rise px-6 pb-5 text-sm text-muted-foreground">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CTA({ title, lead }: { title: string; lead: string }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-midnight-glow p-12 text-midnight-foreground md:p-16">
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-aurora opacity-25 blur-3xl animate-float" />
          <h2 className="relative max-w-2xl font-display text-4xl font-medium">{title}</h2>
          <p className="relative mt-4 max-w-xl text-midnight-foreground/70">{lead}</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-midnight-foreground px-7 py-3.5 font-semibold text-midnight"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Small animated "agent feed" card used as hero visuals. */
export function FeedCard({ title, rows }: { title: string; rows: [string, string][] }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % rows.length) + 1), 1600);
    return () => clearInterval(t);
  }, [rows.length]);
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-midnight-foreground/15 bg-midnight/80 p-6 shadow-glow backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <span className="flex items-center gap-2 text-xs text-midnight-foreground/60">
          <span className="h-2 w-2 animate-pulse rounded-full bg-aurora" />
          Live
        </span>
      </div>
      <div className="mt-5 space-y-2">
        {rows.slice(0, n).map(([a, b]) => (
          <div
            key={a}
            className="animate-rise flex items-center justify-between rounded-xl bg-midnight-foreground/5 px-4 py-3 text-sm"
          >
            <span>{a}</span>
            <span className="text-xs text-aurora">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
