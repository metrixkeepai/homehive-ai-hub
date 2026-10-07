import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { Menu, X, ChevronDown, Check, ArrowRight, Home, Building2, Landmark } from "lucide-react";
import { Logo } from "@/components/hv/Logo";

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

const solutions = [
  { to: "/individual", t: "Individual", d: "Homes, belongings, families", icon: Home },
  { to: "/business", t: "Business", d: "SMEs, shops, clinics, offices", icon: Building2 },
  { to: "/enterprise", t: "Enterprise", d: "Multi-site, governance, scale", icon: Landmark },
] as const;
const links = [["/features", "Features"], ["/pricing", "Pricing"], ["/security", "Security"], ["/about", "About"], ["/contact", "Contact"]] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [sol, setSol] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 20); f(); window.addEventListener("scroll", f); return () => window.removeEventListener("scroll", f); }, []);
  const lc = "text-sm text-midnight-foreground/70 transition hover:text-midnight-foreground";
  return (
    <header className={`sticky top-0 z-50 text-midnight-foreground transition ${scrolled ? "bg-midnight/90 shadow-soft backdrop-blur" : "bg-midnight"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo light />
        <nav className="hidden items-center gap-7 lg:flex">
          <div className="relative" onMouseEnter={() => setSol(true)} onMouseLeave={() => setSol(false)}>
            <button className={`${lc} flex items-center gap-1`} onClick={() => setSol((v) => !v)} aria-expanded={sol}>Solutions <ChevronDown className="h-3.5 w-3.5" /></button>
            {sol && (
              <div className="absolute left-1/2 top-full w-80 -translate-x-1/2 pt-3">
                <div className="animate-rise rounded-2xl border border-midnight-foreground/10 bg-midnight p-2 shadow-glow">
                  {solutions.map((s) => (
                    <Link key={s.to} to={s.to} onClick={() => setSol(false)} className="flex items-start gap-3 rounded-xl p-3 hover:bg-midnight-foreground/5">
                      <s.icon className="mt-0.5 h-5 w-5 text-aurora" />
                      <span><span className="block text-sm font-semibold">{s.t}</span><span className="text-xs text-midnight-foreground/60">{s.d}</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {links.map(([to, t]) => <Link key={to} to={to} className={lc} activeProps={{ className: "text-midnight-foreground" }}>{t}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="hidden text-sm text-midnight-foreground/80 hover:text-midnight-foreground sm:block">Sign in</Link>
          <Link to="/auth" className="rounded-full bg-midnight-foreground px-5 py-2 text-sm font-semibold text-midnight transition hover:opacity-90">Start free</Link>
          <button aria-label="Open menu" className="rounded-full border border-midnight-foreground/20 p-2 lg:hidden" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </div>
      {open && (
        <div className="animate-rise border-t border-midnight-foreground/10 px-6 pb-6 lg:hidden">
          {solutions.map((s) => <Link key={s.to} to={s.to} onClick={() => setOpen(false)} className="flex items-center gap-3 py-3 text-sm"><s.icon className="h-4 w-4 text-aurora" />{s.t}</Link>)}
          {links.map(([to, t]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="block py-3 text-sm text-midnight-foreground/80">{t}</Link>)}
          <Link to="/auth" onClick={() => setOpen(false)} className="block py-3 text-sm">Sign in</Link>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    ["Solutions", [["/individual", "Individual"], ["/business", "Business"], ["/enterprise", "Enterprise"]]],
    ["Product", [["/features", "Features"], ["/pricing", "Pricing"], ["/security", "Security"]]],
    ["Company", [["/about", "About"], ["/contact", "Contact"], ["/auth", "Sign in"]]],
  ];
  return (
    <footer className="bg-midnight text-midnight-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-midnight-foreground/60">Keep what matters. Know what’s next. The AI Digital Passport for everything you own, operate and need to remember.</p>
        </div>
        {cols.map(([h, ls]) => (
          <div key={h}>
            <p className="text-xs font-semibold uppercase tracking-wider text-midnight-foreground/50">{h}</p>
            <ul className="mt-4 space-y-2 text-sm">{ls.map(([to, t]) => <li key={to}><Link to={to} className="text-midnight-foreground/75 hover:text-midnight-foreground">{t}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-midnight-foreground/10">
        <p className="mx-auto max-w-7xl px-6 py-6 text-xs text-midnight-foreground/50">© 2026 MatrixKeep. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background"><SiteHeader /><main>{children}</main><SiteFooter /></div>;
}

export function PageHero({ eyebrow, title, accent, lead, cta = "Start free", visual }: { eyebrow: string; title: string; accent?: string; lead: string; cta?: string; visual?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-midnight-glow text-midnight-foreground">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-aurora opacity-20 blur-3xl animate-float" />
      <div className={`relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 ${visual ? "lg:grid-cols-2" : ""}`}>
        <div className="animate-rise">
          <span className="inline-flex rounded-full border border-midnight-foreground/15 px-3 py-1 text-xs text-midnight-foreground/80">{eyebrow}</span>
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">{title} {accent && <em className="text-aurora not-italic">{accent}</em>}</h1>
          <p className="mt-6 max-w-xl text-lg text-midnight-foreground/70">{lead}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-full bg-aurora px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.03]">{cta}</Link>
            <Link to="/pricing" className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold transition hover:bg-midnight-foreground/5">See pricing</Link>
          </div>
        </div>
        {visual && <div className="animate-float">{visual}</div>}
      </div>
    </section>
  );
}

export function FeatureGrid({ title, lead, items }: { title: string; lead?: string; items: { icon: ComponentType<{ className?: string }>; t: string; d: string }[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal><h2 className="max-w-2xl font-display text-4xl font-medium tracking-tight md:text-5xl">{title}</h2>{lead && <p className="mt-4 max-w-xl text-muted-foreground">{lead}</p>}</Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <Reveal key={f.t} delay={i * 70}>
            <div className="group h-full rounded-3xl border bg-card p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-glow">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary transition group-hover:bg-aurora"><f.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground" /></span>
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
      <Reveal><p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</p></Reveal>
      <div className="flex w-max animate-marquee gap-3">
        {row.map((x, i) => <span key={i} className="whitespace-nowrap rounded-full border bg-card px-5 py-2.5 text-sm shadow-soft">{x}</span>)}
      </div>
    </section>
  );
}

export function Checklist({ title, items, side }: { title: string; items: string[]; side: ReactNode }) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
      <Reveal>
        <h2 className="font-display text-4xl font-medium tracking-tight">{title}</h2>
        <ul className="mt-8 space-y-3">{items.map((x) => <li key={x} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{x}</span></li>)}</ul>
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
            <button onClick={() => setO(o === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold" aria-expanded={o === i}>{q}<ChevronDown className={`h-4 w-4 shrink-0 transition ${o === i ? "rotate-180" : ""}`} /></button>
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
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-midnight-foreground px-7 py-3.5 font-semibold text-midnight">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/contact" className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold">Talk to us</Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Small animated "agent feed" card used as hero visuals. */
export function FeedCard({ title, rows }: { title: string; rows: [string, string][] }) {
  const [n, setN] = useState(1);
  useEffect(() => { const t = setInterval(() => setN((v) => (v % rows.length) + 1), 1600); return () => clearInterval(t); }, [rows.length]);
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-midnight-foreground/15 bg-midnight/80 p-6 shadow-glow backdrop-blur">
      <div className="flex items-center justify-between"><p className="font-semibold">{title}</p><span className="flex items-center gap-2 text-xs text-midnight-foreground/60"><span className="h-2 w-2 animate-pulse rounded-full bg-aurora" />Live</span></div>
      <div className="mt-5 space-y-2">
        {rows.slice(0, n).map(([a, b]) => (
          <div key={a} className="animate-rise flex items-center justify-between rounded-xl bg-midnight-foreground/5 px-4 py-3 text-sm"><span>{a}</span><span className="text-xs text-aurora">{b}</span></div>
        ))}
      </div>
    </div>
  );
}
