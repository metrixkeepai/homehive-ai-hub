import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, Package, FileText, ShieldCheck, Wrench, Umbrella, Home, Check, Lock, Car, Sparkles } from "lucide-react";
import { SiteShell, Reveal } from "@/components/hv/Site";

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

const agents = [
  { name: "Vision", icon: Eye },
  { name: "Asset", icon: Package },
  { name: "Document", icon: FileText },
  { name: "Warranty", icon: ShieldCheck },
  { name: "Maintenance", icon: Wrench },
  { name: "Insurance", icon: Umbrella },
];
const events = [
  "Kitchen scan completed",
  "12 assets identified",
  "Amazon receipt matched",
  "Boiler service due next month",
  "TV warranty expires in 26 days",
];

function AgentOrbit() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % events.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <div className="absolute inset-[8%] rounded-full border border-midnight-foreground/10" />
      <div className="absolute inset-[24%] rounded-full border border-midnight-foreground/10" />
      <div className="absolute inset-0 animate-orbit">
        {agents.map((a, idx) => {
          const ang = (idx / agents.length) * Math.PI * 2;
          const x = 50 + 42 * Math.cos(ang);
          const y = 50 + 42 * Math.sin(ang);
          return (
            <div key={a.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="animate-counter-orbit flex flex-col items-center gap-1">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-midnight-foreground/15 bg-midnight/80 backdrop-blur">
                  <a.icon className="h-5 w-5 text-aurora" />
                </span>
                <span className="text-[11px] font-medium text-midnight-foreground/70">{a.name}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 rounded-3xl bg-aurora animate-pulse-ring" />
        <div className="relative grid h-28 w-28 place-items-center rounded-3xl bg-aurora shadow-glow">
          <Home className="h-12 w-12 text-primary-foreground" strokeWidth={1.5} />
        </div>
      </div>
      <div key={i} className="animate-rise absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-midnight-foreground/15 bg-midnight/90 px-4 py-2 text-sm text-midnight-foreground backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-aurora" /> {events[i]}
      </div>
    </div>
  );
}

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
      <section className="bg-midnight-glow text-midnight-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 pb-28 pt-16 lg:grid-cols-2">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-midnight-foreground/15 px-3 py-1 text-xs text-midnight-foreground/80">
              <Sparkles className="h-3.5 w-3.5 text-aurora" /> For homes, businesses &amp; enterprises
            </span>
            <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
              Keep what matters. <em className="text-aurora not-italic">Know what’s next.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-midnight-foreground/70">
              The AI Digital Passport for everything you own, operate and need to remember. Capture it once — MatrixKeep organises it, remembers it and watches what happens next.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/auth" className="rounded-full bg-aurora px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]">Start free</Link>
              <a href="#how" className="rounded-full border border-midnight-foreground/20 px-7 py-3.5 font-semibold transition hover:bg-midnight-foreground/5">See how it works</a>
            </div>
          </div>
          <AgentOrbit />
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
