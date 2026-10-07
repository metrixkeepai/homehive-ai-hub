import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Package, FileText, ShieldCheck, Wrench, Umbrella, Home, Check, Lock, Car, Sparkles, Receipt, Bell } from "lucide-react";
import { SiteShell, Reveal } from "@/components/hv/Site";
import { HeroPassport, MatrixNodes, Tick } from "@/components/hv/HeroPassport";
import tv from "@/assets/passport-tv.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatrixKeep — Keep What Matters. Know What’s Next." },
      { name: "description", content: "The AI Digital Passport for everything you own, operate and need to remember." },
      { property: "og:title", content: "MatrixKeep — Keep What Matters. Know What’s Next." },
      { property: "og:description", content: "Capture it once. MatrixKeep organises it, remembers it and watches what happens next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Eye, t: "Scan your home", d: "Walk through with your phone. Vision Agent identifies rooms and everything in them." },
  { icon: FileText, t: "Every document, found", d: "Receipts, manuals and policies are read, matched and filed automatically." },
  { icon: ShieldCheck, t: "Warranties watched", d: "Know before cover ends — and get help when something breaks." },
  { icon: Wrench, t: "Maintenance, remembered", d: "Boiler services, filters, gutters. Reminders arrive before problems do." },
  { icon: Umbrella, t: "Insurance ready", d: "A claim pack with photos, values and proof of ownership in one tap." },
  { icon: Car, t: "Vehicles included", d: "MOT, tax, servicing and insurance renewals tracked for every car." },
];

const plans = [
  { n: "Free", p: "£0", d: "Get started with one home", f: ["50 items", "Basic AI agents", "1 member"] },
  { n: "Home", p: "£4.99", d: "Your whole home, organised", f: ["Unlimited items", "All AI agents", "Email import", "2 members"], hi: true },
  { n: "Home+", p: "£9.99", d: "Property & vehicles too", f: ["Everything in Home", "Property passport", "Vehicles", "Claim packs"] },
  { n: "Family", p: "£14.99", d: "Built for the household", f: ["Everything in Home+", "6 members & roles", "Shared tasks", "Priority support"] },
];

function Landing() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden bg-midnight-glow text-midnight-foreground">
        <MatrixNodes />
        <div className="relative mx-auto grid min-h-[92vh] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-midnight-foreground/15 px-3 py-1 text-[11px] font-semibold tracking-widest text-midnight-foreground/80">
              <Sparkles className="h-3.5 w-3.5 text-aurora" /> AGENTIC AI • DIGITAL PASSPORT • RENEWAL INTELLIGENCE
            </span>
            <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
              Keep What Matters.<br /><span className="inline-block animate-rise text-aurora [animation-delay:400ms]">Know What’s Next.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-midnight-foreground/70">
              MatrixKeep creates a living AI-powered digital passport for your assets, receipts, warranties, documents and renewals — then continuously monitors what matters so you never lose track of what happens next.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/auth" className="rounded-full bg-aurora px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]">Start Free</Link>
              <a href="#story" className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold transition hover:bg-midnight-foreground/5">Watch How It Works</a>
              <Link to="/business" className="px-3 py-3.5 font-semibold text-aurora transition hover:translate-x-1">Explore for Business →</Link>
            </div>
          </div>
          <HeroPassport />
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-sm text-muted-foreground">
          {["Homeowners", "Renters", "Families", "Landlords", "Retailers", "Restaurants", "Clinics", "Schools", "Multi-site operators"].map((x) => <span key={x}>{x}</span>)}
        </div>
      </section>

      <section id="story" className="mx-auto max-w-7xl px-6 py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">The problem</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-medium tracking-tight md:text-5xl">Receipts in inboxes. Warranties in drawers. Renewals in someone’s head.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-4">
          {([[Receipt, "Lost receipts", "Proof of purchase vanishes when you need it most."], [ShieldCheck, "Missed warranties", "Cover quietly ends before anyone notices."], [Bell, "Surprise renewals", "Insurance, MOT and contracts auto-renew at worse prices."], [Umbrella, "Weak claims", "No photos, no values, no evidence."]] as const).map(([I, t, d], i) => (
            <Reveal key={t} delay={i * 90}>
              <div className="h-full rounded-3xl border bg-card p-7 shadow-soft transition hover:-translate-y-1">
                <I className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-midnight-glow text-midnight-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-28 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-aurora">Give MatrixKeep anything</p>
            <h2 className="mt-3 font-display text-4xl font-medium md:text-5xl">Capture it once. MatrixKeep remembers what happens next.</h2>
            <ul className="mt-8 space-y-3 text-midnight-foreground/80">
              <Tick>Snap a photo — the AI names the item, brand and room.</Tick>
              <Tick>Scan a receipt — price, retailer and purchase date are read for you.</Tick>
              <Tick>Upload a document — warranty length and expiry are calculated.</Tick>
              <Tick>Speak or forward an email — it becomes a linked record.</Tick>
            </ul>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative overflow-hidden rounded-[2rem] border border-midnight-foreground/10">
              <img src={tv} alt="Living room with a television being recorded" loading="lazy" width={1024} height={768} className="h-full w-full object-cover" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-midnight/85 p-4 text-sm backdrop-blur">
                <p className="text-aurora">AI understood</p>
                <p className="mt-1">Samsung QLED 65” · Living Room · £1,299 · Warranty to 12 Mar 2028</p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 animate-scan bg-aurora/70 shadow-glow" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Warranty &amp; renewal intelligence</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-medium tracking-tight md:text-5xl">A timeline that watches the future for you.</h2>
        </Reveal>
        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-5 h-px bg-border" />
          <div className="grid gap-8 md:grid-cols-5">
            {[["Mar 2026", "TV purchased", "Receipt + photo saved"], ["Sep 2026", "Boiler service", "Reminder sent 2 weeks before"], ["Jan 2027", "Home insurance renewal", "Compare before it auto-renews"], ["Feb 2028", "Warranty ends in 30 days", "Sera suggests a check-up"], ["Mar 2028", "Warranty expired", "Evidence kept for insurance"]].map(([d, t, n], i) => (
              <Reveal key={t} delay={i * 110}>
                <div className="relative">
                  <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-aurora text-primary-foreground shadow-glow"><Bell className="h-4 w-4" /></span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">{d}</p>
                  <h3 className="mt-1 font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{n}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-24">
        <div className="grid gap-5 md:grid-cols-3">
          {([["/individual", "Individual", "Your home, belongings, receipts, warranties and important dates — remembered by AI."], ["/business", "Business", "Every asset, document, warranty, contract and renewal across every location — under control."], ["/enterprise", "Enterprise", "Agentic asset, evidence and renewal intelligence at enterprise scale."]] as const).map(([to, t, d], i) => (
            <Reveal key={to} delay={i * 100}>
              <Link to={to} className="group block h-full rounded-3xl border bg-card p-8 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">MatrixKeep for</p>
                <h3 className="mt-2 font-display text-3xl">{t}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{d}</p>
                <span className="mt-6 inline-block text-sm font-semibold text-primary transition group-hover:translate-x-1">Explore {t} →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-28">
        <h2 className="max-w-2xl font-display text-4xl font-medium tracking-tight md:text-5xl">An AI team that does more than chat.</h2>
        <p className="mt-4 max-w-xl text-muted-foreground">Six specialist agents work quietly in the background, so you only deal with what matters.</p>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-3xl border bg-card p-7 shadow-soft transition duration-300 hover:-translate-y-1">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary"><f.icon className="h-5 w-5 text-primary" /></span>
              <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-y bg-secondary/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-24 md:grid-cols-3">
          {[["01", "Scan or add", "Film a room, snap a receipt or forward an email."], ["02", "Agents organise", "Items, documents and warranties are linked into a Home Passport."], ["03", "You decide", "Open the app to two clear actions — not a spreadsheet."]].map(([n, t, d]) => (
            <div key={n}>
              <span className="font-display text-5xl text-aurora">{n}</span>
              <h3 className="mt-3 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <h2 className="text-center font-display text-4xl font-medium tracking-tight md:text-5xl">Simple, household pricing.</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.n} className={`rounded-3xl border p-7 ${p.hi ? "bg-midnight text-midnight-foreground shadow-glow" : "bg-card shadow-soft"}`}>
              <h3 className="font-semibold">{p.n}</h3>
              <p className={`mt-1 text-sm ${p.hi ? "text-midnight-foreground/70" : "text-muted-foreground"}`}>{p.d}</p>
              <p className="mt-6 font-display text-4xl">{p.p}<span className="text-sm opacity-60">/mo</span></p>
              <ul className="mt-6 space-y-2 text-sm">
                {p.f.map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-aurora" />{x}</li>)}
              </ul>
              <Link to="/auth" className={`mt-8 block rounded-full py-2.5 text-center text-sm font-semibold ${p.hi ? "bg-aurora text-primary-foreground" : "border hover:bg-secondary"}`}>Choose {p.n}</Link>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-6 pb-28">
        <div className="rounded-[2rem] bg-midnight-glow p-12 text-midnight-foreground md:p-16">
          <Lock className="h-8 w-8 text-aurora" />
          <h2 className="mt-6 max-w-2xl font-display text-4xl font-medium">Private by design. Yours alone.</h2>
          <p className="mt-4 max-w-xl text-midnight-foreground/70">Encrypted storage, granular household permissions and secure, time-limited sharing for insurers or tradespeople.</p>
          <Link to="/auth" className="mt-8 inline-block rounded-full bg-midnight-foreground px-7 py-3.5 font-semibold text-midnight">Give your home a memory</Link>
        </div>
      </section>

    </SiteShell>
  );
}
