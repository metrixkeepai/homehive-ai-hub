import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Pause, Play, FileCheck2, Sparkles, ShieldCheck, Camera, FileText, Package, Wrench, CalendarClock, Car, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photos, scenes, storyPhoto } from "./media";

const MotionContext = createContext({ paused: false });
export function LivingSurface({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(mq.matches);
    change(); mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((e) => {
      e.target.classList.toggle("mk-in-view", e.isIntersecting);
      if (e.isIntersecting) e.target.classList.add("mk-seen");
    }), { threshold: 0.06 });
    el.querySelectorAll("main section, .mk-problem-photo, .mk-passport, .mk-worlds article, .mk-industries a").forEach((s) => observer.observe(s));
    let frame = 0;
    const scroll = () => {
      if (frame || reduced || paused) return;
      frame = requestAnimationFrame(() => {
        el.querySelectorAll<HTMLElement>(".mk-in-view").forEach((s) => {
          const r = s.getBoundingClientRect();
          s.style.setProperty("--travel", `${Math.max(-18, Math.min(18, (window.innerHeight / 2 - r.top - r.height / 2) * 0.035))}px`);
        });
        frame = 0;
      });
    };
    window.addEventListener("scroll", scroll, { passive: true }); scroll();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); };
  }, [path, paused, reduced]);
  function pointer(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || paused || reduced) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(".mk-depth, .mk-passport, .mk-use-card, .mk-price, .mk-intelligence");
    if (!target) return;
    const r = target.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5;
    target.style.setProperty("--rx", `${-y * 3}deg`); target.style.setProperty("--ry", `${x * 4}deg`);
  }
  return <MotionContext.Provider value={{ paused: paused || reduced }}><div ref={root} className="marketing-site mk-living" data-motion={paused || reduced ? "paused" : "playing"} onPointerMove={pointer}>
    {children}
    <Button className="mk-motion-toggle" variant="outline" size="icon" aria-label={paused ? "Resume website motion" : "Pause website motion"} title={paused ? "Resume website motion" : "Pause website motion"} onClick={() => setPaused(!paused)}>{paused || reduced ? <Play className="size-4" /> : <Pause className="size-4" />}</Button>
  </div></MotionContext.Provider>;
}

const heroScenes = [
  { key: "life", label: "For life", title: "Your entire world. Intelligently connected.", image: scenes["life"] ?? photos.world, to: "/individual", cta: "Explore Individuals", objects: ["Television", "Refrigerator", "Laptop", "Home documents", "Washing machine"], record: "Living room television", value: "£1,300", status: "Warranty review due", evidence: "Purchase receipt connected", date: "Review before 30 November" },
  { key: "business", label: "For business", title: "Everything your team needs to know.", image: scenes["business"] ?? photos.cafe, to: "/business", cta: "Explore Business", objects: ["Espresso machine", "Refrigeration", "Point of sale", "Business laptop"], record: "Commercial espresso machine", value: "£4,800", status: "Maintenance approaching", evidence: "Service report connected", date: "Engineer review · January" },
  { key: "intelligence", label: "Intelligence", title: "Real-world assets. Intelligent digital passports.", image: scenes["intelligence"] ?? photos.it, to: "/how-it-works", cta: "See How It Works", objects: ["Capture", "Recognise", "Connect evidence", "Assemble passport"], record: "Business workstation", value: "£1,850", status: "Passport assembled", evidence: "Invoice and warranty connected", date: "Sera · Evidence ready to review" },
] as const;
export function CinematicHero() {
  const [index, setIndex] = useState(0); const [object, setObject] = useState(0); const [stopped, setStopped] = useState(false);
  const { paused } = useContext(MotionContext); const startX = useRef<number | null>(null); const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const scene = heroScenes[index] ?? heroScenes[0];
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting))); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (paused || stopped || !visible) return;
    const timer = setInterval(() => { setIndex((i) => (i + 1) % 3); setObject(0); }, 10000);
    return () => clearInterval(timer);
  }, [paused, stopped, visible]);
  useEffect(() => {
    if (paused || stopped || !visible) return;
    const timer = setInterval(() => setObject((i) => (i + 1) % scene.objects.length), 2400);
    return () => clearInterval(timer);
  }, [paused, stopped, visible, scene]);
  const objectRecords = scene.key === "life"
    ? [{ value: "£1,300", evidence: "Purchase receipt connected", status: "Warranty review due" }, { value: "£849", evidence: "Warranty terms connected", status: "Cover review · December" }, { value: "£1,850", evidence: "Supplier invoice connected", status: "Device evidence ready" }, { value: "—", evidence: "Property records connected", status: "Insurance evidence saved" }, { value: "£649", evidence: "Purchase receipt connected", status: "Filter service · January" }]
    : scene.key === "business"
      ? [{ value: "£4,800", evidence: "Engineer report connected", status: "Service review · January" }, { value: "£2,400", evidence: "Warranty certificate connected", status: "Cover review · December" }, { value: "£950", evidence: "Supplier invoice connected", status: "Equipment record available" }, { value: "£1,850", evidence: "Purchase receipt connected", status: "Warranty recorded" }]
      : [{ value: "£1,850", evidence: "Asset photograph captured", status: "Capture ready for review" }, { value: "£1,850", evidence: "Workstation identity proposed", status: "Check the extracted details" }, { value: "£1,850", evidence: "Invoice and warranty connected", status: "Evidence assembled" }, { value: "£1,850", evidence: "Asset history brought together", status: "Digital Passport ready" }];
  const selected = objectRecords[object] ?? objectRecords[0];
  const choose = (i: number) => { setIndex((i + 3) % 3); setObject(0); setStopped(true); };
  return <section className="mk-cinema mk-depth" ref={ref} aria-label="MatrixKeep cinematic introduction" onPointerDown={(e) => { if (e.pointerType === "touch") startX.current = e.clientX; }} onPointerUp={(e) => { const x = startX.current; if (x !== null && Math.abs(e.clientX - x) > 50) choose(index + (e.clientX < x ? 1 : -1)); startX.current = null; }}>
    {heroScenes.map((s, i) => <div key={s.key} className={`mk-cinema-image ${i === index ? "is-active" : ""}`} aria-hidden={i !== index}><img src={s.image} alt={s.title} fetchPriority={i === 0 ? "high" : "low"} loading={i === 0 ? "eager" : "lazy"} width="1536" height="1024" /></div>)}
    <div className="mk-cinema-shade" />
    <div className="mk-container mk-cinema-body">
      <div className="mk-cinema-copy">
        <p className="mk-hero-kicker"><Sparkles className="size-4" /> MATRIXKEEP · ASSET INTELLIGENCE</p>
        <h1>Everything you own.<br />Everything you operate.<br /><em>Nothing important forgotten.</em></h1>
        <p className="mk-lead">Assets, documents, warranties, insurance, maintenance and operational obligations. Intelligently connected.</p>
        <p className="mk-cinema-tagline">Own smarter. Operate better. Stay ahead.</p>
        <div className="mk-actions"><Button asChild><Link to="/auth">Start Free <ArrowRight className="size-4" /></Link></Button><Button asChild variant="outline"><Link to={scene.to}>{scene.cta}<ArrowRight className="size-4" /></Link></Button></div>
      </div>
      <div className="mk-cinema-world" key={scene.key}>
        <div className="mk-scene-heading"><span>0{index + 1} / 03 · {scene.label}</span><h2>{scene.title}</h2></div>
        <div className="mk-object-points" role="group" aria-label="Explore scene assets">{scene.objects.map((name, i) => <Button key={name} variant="ghost" className={`mk-point mk-point-${i} ${object === i ? "is-active" : ""}`} aria-pressed={object === i} onClick={() => { setObject(i); setStopped(true); }}><span className="mk-point-dot" /><span>{name}</span></Button>)}</div>
        <svg className="mk-scene-connections" viewBox="0 0 500 300" aria-hidden="true"><path d="M140 55 C330 55 80 260 330 220 M340 80 Q450 150 330 220 M70 170 Q180 220 330 220" /></svg>
        <div className="mk-cinema-passport"><div className="mk-passport-mini-title"><FileCheck2 className="size-4" /><span>Digital Passport</span><Check className="size-4" /></div><h3>{object === 0 ? scene.record : scene.objects[object]}</h3><p>{selected?.evidence ?? scene.evidence}</p><div><span>Recorded purchase</span><strong>{selected?.value ?? scene.value}</strong></div><div className="mk-cinema-insight"><ShieldCheck className="size-4" /><span>{selected?.status ?? scene.status}<small>{scene.date}</small></span></div></div>
      </div>
    </div>
    <div className="mk-container mk-cinema-bottom"><div className="mk-scene-controls"><Button variant="ghost" size="icon" aria-label="Previous scene" onClick={() => choose(index - 1)}><ArrowLeft className="size-4" /></Button>{heroScenes.map((s, i) => <Button variant="ghost" key={s.key} aria-label={`Show ${s.label} scene`} aria-pressed={index === i} onClick={() => choose(i)}><span className="mk-scene-bar" /><span>{s.label}</span></Button>)}<Button variant="ghost" size="icon" aria-label="Next scene" onClick={() => choose(index + 1)}><ArrowRight className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={stopped ? "Play scenes" : "Pause scenes"} onClick={() => setStopped(!stopped)}>{stopped ? <Play className="size-4" /> : <Pause className="size-4" />}</Button></div><p>Illustrative records · Your evidence, your decisions.</p></div>
  </section>;
}

const categories = [
  { icon: Camera, title: "Vision Intelligence", text: "Capture an asset photograph. Review the proposed identity.", source: "Asset photograph", image: photos.appliance },
  { icon: FileText, title: "Document Intelligence", text: "Bring purchase details out of the receipt and into the asset record.", source: "Supplier invoice · £4,800", image: photos.coffee },
  { icon: Package, title: "Asset Intelligence", text: "Identity, location and supporting evidence belong together.", source: "Workstation · Head office", image: photos.it },
  { icon: ShieldCheck, title: "Warranty Intelligence", text: "Keep cover dates beside the terms and purchase evidence.", source: "Warranty · Review December", image: photos.appliance },
  { icon: Wrench, title: "Maintenance Intelligence", text: "Review the recorded service history before arranging the next visit.", source: "Engineer report · January", image: photos.coffee },
  { icon: CalendarClock, title: "Renewal Intelligence", text: "Connect saved notice deadlines to their original contracts.", source: "Contract · Notice deadline", image: photos.it },
  { icon: Car, title: "Vehicle Intelligence", text: "Service records, insurance and MOT dates, in one vehicle passport.", source: "Family vehicle · Insurance", image: photos.vehicle },
  { icon: Sparkles, title: "Sera AI Assistant", text: "Ask about saved information and review the connected evidence.", source: "Sera · Relevant records found", image: photos.dental },
];
export function IntelligenceShowcase() {
  const [active, setActive] = useState(0); const current = categories[active] ?? categories[0];
  if (!current) return null;
  return <section className="mk-intelligence"><div className="mk-container mk-section"><p className="mk-eyebrow">MATRIXKEEP INTELLIGENCE · HUMAN-DIRECTED</p><h2>Intelligence that<br /><em>connects everything.</em></h2><div className="mk-intelligence-layout"><div className="mk-network"><svg viewBox="0 0 600 440" aria-hidden="true"><path d="M300 220 L95 45 M300 220 L95 155 M300 220 L95 265 M300 220 L95 375 M300 220 L505 45 M300 220 L505 155 M300 220 L505 265 M300 220 L505 375" /></svg><div className="mk-network-core"><Sparkles /><strong>MatrixKeep</strong><span>Connected evidence</span></div><div className="mk-network-nodes">{categories.map((c, i) => <Button key={c.title} variant="ghost" aria-pressed={active === i} onClick={() => setActive(i)}><c.icon className="size-4" /><span>{c.title}</span></Button>)}</div></div><div className="mk-intelligence-preview" key={current.title}><img src={current.image} alt={current.title + " example asset"} width="627" height="627" loading="lazy" /><div><p className="mk-eyebrow">Illustrative evidence journey</p><h3>{current.title}</h3><p>{current.text}</p><span><FileCheck2 className="size-4" />{current.source}</span></div></div></div><div className="mk-roadmap"><strong>Advanced roadmap · Not a claim of current availability</strong><span>Compliance reasoning</span><span>Evidence verification</span><span>Risk intelligence</span><span>Human-supervised remediation</span></div></div></section>;
}

const locations = [
  { name: "Café", slug: "hospitality", asset: "Espresso machine", evidence: "Supplier invoice", alert: "Service review · January", value: "£4,800" },
  { name: "Retail store", slug: "retail", asset: "Display refrigeration", evidence: "Warranty certificate", alert: "Cover review · December", value: "£2,400" },
  { name: "Office", slug: "offices", asset: "Business workstation", evidence: "Purchase receipt", alert: "Device review · December", value: "£1,850" },
  { name: "Warehouse", slug: "warehousing-logistics", asset: "Forklift", evidence: "Engineer inspection", alert: "Service review · February", value: "£18,500" },
];
const rooms = [
  { name: "Living room", image: photos.world, asset: "Television", evidence: "Purchase receipt", alert: "Warranty review · November", value: "£1,300" },
  { name: "Kitchen", image: scenes["property-asset-intelligence"] ?? photos.appliance, asset: "Refrigerator", evidence: "Warranty terms", alert: "Cover review · December", value: "£849" },
  { name: "Bedroom", image: scenes["home-inventory"] ?? photos.family, asset: "Personal belongings", evidence: "Purchase evidence", alert: "Evidence check · December", value: "£420" },
  { name: "Garage", image: photos.vehicle, asset: "Family vehicle", evidence: "Insurance policy", alert: "Insurance renewal · February", value: "£24,500" },
  { name: "Utility room", image: photos.appliance, asset: "Washing machine", evidence: "Purchase receipt", alert: "Filter service · January", value: "£649" },
  { name: "Home office", image: photos.it, asset: "Laptop", evidence: "Supplier invoice", alert: "Warranty review · September", value: "£1,850" },
];
export function EnvironmentExplorer({ personal = false }: { personal?: boolean }) {
  const [index, setIndex] = useState(0); const list = personal ? rooms : locations; const item = list[index] ?? list[0];
  if (!item) return null;
  const image = "image" in item ? item.image : storyPhoto(item.slug);
  return <section className="mk-environment"><div className="mk-container mk-section"><p className="mk-eyebrow">{personal ? "YOUR DIGITAL HOME" : "MULTI-LOCATION INTELLIGENCE"}</p><h2>{personal ? "A memory for every room." : "Different locations. One connected memory."}</h2><div className="mk-tabs" role="group" aria-label={personal ? "Explore household rooms" : "Explore business locations"}>{list.map((l, i) => <Button variant="outline" key={l.name} aria-pressed={i === index} onClick={() => setIndex(i)}><MapPin className="size-3.5" />{l.name}</Button>)}</div><div className="mk-environment-scene" key={item.name}><img src={image} alt={item.name + " example environment"} loading="lazy" width="627" height="627" /><div className="mk-environment-record"><p className="mk-eyebrow">{item.name} · Example Digital Passport</p><h3>{item.asset}</h3><strong className="mk-environment-value">{item.value}</strong><p>Recorded purchase value</p><div><FileText className="size-4" />{item.evidence} connected</div><div><CalendarClock className="size-4" />{item.alert}</div><div><Sparkles className="size-4" />Sera · Evidence ready to review</div></div></div><p className="mk-demo-label">Local illustrative records · No live account data.</p></div></section>;
}

export function LivingOverlay({ label = "Asset record", rows = ["Purchase evidence connected", "Warranty record available", "Maintenance date recorded"] }: { label?: string; rows?: string[] }) {
  return <div className="mk-living-overlay" aria-label="Illustrative asset information"><span className="mk-overlay-marker" /><div><p><Sparkles className="size-3.5" />{label}</p>{rows.slice(0, 3).map((row) => <span key={row}><Check className="size-3" />{row}</span>)}<small>Illustrative records</small></div></div>;
}