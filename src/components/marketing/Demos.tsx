import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  FileText,
  ShieldCheck,
  Sparkles,
  Check,
  MapPin,
  CalendarClock,
  Users, Package, HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { photos } from "./media";
import { calculateRoi, type RoiInputs } from "./roi";
import { plans, type Audience } from "@/lib/plans";
import { useInactivePlans, usePublishedPlans } from "@/lib/plan-status";
import { Reveal } from "@/components/hv/Site";
import { CompareTable } from "@/components/hv/PlanCard";

const assets = [
  {
    key: "television", tab: "Television", name: "Living room television", category: "Home entertainment", value: "£1,300", location: "Home · Living room", purchase: "20 November 2024", warranty: "20 November 2027", maintenance: "Device check · 20 November 2026", alert: "Keep the receipt and warranty terms together.", image: photos.world, docs: ["Purchase receipt", "Warranty terms", "Asset photograph"],
  },
  {
    key: "appliance",
    tab: "Appliance",
    name: "Bosch washing machine",
    category: "Household appliance",
    value: "£649",
    location: "Utility room · Home",
    purchase: "12 March 2026",
    warranty: "12 March 2028",
    maintenance: "Filter cleaned · 18 October 2026",
    alert: "Review cover before the warranty expires.",
    image: photos.appliance,
    docs: ["Purchase receipt", "Warranty terms", "User manual"],
  },
  {
    key: "vehicle",
    tab: "Vehicle",
    name: "Family estate car",
    category: "Family vehicle",
    value: "£24,500",
    location: "Home · Driveway",
    purchase: "8 February 2025",
    warranty: "8 February 2028",
    maintenance: "Annual service · 12 September 2026",
    alert: "Review the insurance renewal on 8 February.",
    image: photos.vehicle,
    docs: ["Purchase invoice", "Insurance policy", "Service record"],
  },
  {
    key: "coffee",
    tab: "Coffee machine",
    name: "Commercial espresso machine",
    category: "Hospitality equipment",
    value: "£4,800",
    location: "High Street Café · Counter",
    purchase: "14 January 2026",
    warranty: "14 January 2028",
    maintenance: "Engineer service · 14 July 2026",
    alert: "Schedule the next engineer service in January.",
    image: photos.coffee,
    docs: ["Supplier invoice", "Service report", "Warranty certificate"],
  },
  {
    key: "dental",
    tab: "Dental equipment",
    name: "Dental treatment chair",
    category: "Healthcare equipment",
    value: "£12,400",
    location: "Dental practice · Surgery 2",
    purchase: "2 June 2025",
    warranty: "2 June 2027",
    maintenance: "Engineer inspection · 2 June 2026",
    alert: "Check the recorded inspection requirements.",
    image: photos.dental,
    docs: ["Equipment invoice", "Inspection record", "Maintenance manual"],
  },
  {
    key: "it",
    tab: "Business IT",
    name: "Business workstation",
    category: "IT equipment",
    value: "£1,850",
    location: "Head office · Design studio",
    purchase: "21 September 2026",
    warranty: "21 September 2027",
    maintenance: "Device review · 21 October 2026",
    alert: "Keep the purchase evidence with this device.",
    image: photos.it,
    docs: ["Purchase invoice", "Warranty terms", "Device record"],
  },
  {
    key: "property",
    tab: "Property",
    name: "Riverside commercial premises",
    category: "Commercial property",
    value: "£420,000",
    location: "Bristol · Riverside",
    purchase: "10 May 2023",
    warranty: "Individual equipment cover",
    maintenance: "Boiler service · 10 May 2026",
    alert: "Review the property certificate dates.",
    image: photos.enterprise,
    docs: ["Property documents", "Service records", "Insurance evidence"],
  },
  {
    key: "machinery",
    tab: "Machinery",
    name: "CNC milling machine",
    category: "Industrial machinery",
    value: "£38,000",
    location: "Production site · Workshop A",
    purchase: "17 April 2025",
    warranty: "17 April 2027",
    maintenance: "Scheduled service · 17 October 2026",
    alert: "Check the next maintenance interval with the supplier.",
    image: photos.manufacturing,
    docs: ["Supplier invoice", "Operator manual", "Service history"],
  },
];
export function PassportDemo({ personal = false }: { personal?: boolean }) {
  const [evidence, setEvidence] = useState(0);
  const [key, setKey] = useState(personal ? "appliance" : "coffee");
  const list = personal ? assets.filter((a) => ["television", "appliance", "vehicle"].includes(a.key)) : assets;
  const asset = list.find((a) => a.key === key) ?? list[0];
  if (!asset) return null;
  return (
    <section className="mk-container mk-section" id="passport-demo">
      <Reveal>
        <p className="mk-eyebrow">Digital Asset Passports</p>
        <h2>
          Every asset deserves
          <br />a digital identity.
        </h2>
        <p className="mk-lead">
          Its purchase history. Its warranty. Its maintenance. The evidence that matters, connected
          throughout its lifecycle.
        </p>
      </Reveal>
      <div className="mk-tabs" role="group" aria-label="Choose example asset">
        {list.map((a) => (
          <Button
            key={a.key}
            variant="outline"
            aria-pressed={key === a.key}
            onClick={() => { setKey(a.key); setEvidence(0); }}
          >
            {a.tab}
          </Button>
        ))}
      </div>
      <div className="mk-passport" key={asset.key}>
        <div className="mk-passport-photo">
          <img src={asset.image} alt={asset.name} width="627" height="627" loading="lazy" />
          <div className="mk-passport-layers">{asset.docs.map((d, i) => <Button key={d} variant="outline" aria-pressed={evidence === i} onClick={() => setEvidence(i)}><FileText className="size-3.5" />{d}</Button>)}</div>
          <span>
            <MapPin className="mr-1 inline size-3" />
            {asset.location}
          </span>
        </div>
        <div className="mk-passport-info">
          <p className="mk-eyebrow">MatrixKeep · Digital Passport</p>
          <h3>{asset.name}</h3>
          <p className="text-sm text-muted-foreground mt-2">{asset.category}</p>
          <dl className="mk-passport-stats">
            <div>
              <dt>Recorded value</dt>
              <dd>{asset.value}</dd>
            </div>
            <div>
              <dt>Purchase date</dt>
              <dd>{asset.purchase}</dd>
            </div>
            <div>
              <dt>Warranty recorded until</dt>
              <dd>{asset.warranty}</dd>
            </div>
            <div>
              <dt>Latest maintenance</dt>
              <dd>{asset.maintenance}</dd>
            </div>
          </dl>
          <p className="text-xs font-semibold mb-3">Connected evidence</p>
          <div className="mk-evidence">
            {asset.docs.map((d) => (
              <span key={d}>
                <FileText className="size-3.5 text-primary" />
                {d}
              </span>
            ))}
          </div>
          <div className="mk-evidence-selected" aria-live="polite">{asset.docs[evidence]} · Connected to {asset.name}. {evidence === 0 ? `Recorded purchase ${asset.value} · ${asset.purchase}` : evidence === 1 ? `Warranty recorded until ${asset.warranty}` : asset.maintenance}</div>
          <div className="mk-passport-next">
            <Bell className="size-4 text-primary" />
            <div>
              <strong>Suggested next action</strong>
              <p>{asset.alert}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-4 mt-5">
        <p className="mk-demo-label">Interactive product demonstration — illustrative data.</p>
        <Button asChild variant="link">
          <Link to="/auth">
            Give Your Assets a Digital Passport
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
const personalQuestions = [
  {
    q: "Which warranties expire this month?",
    a: "In this example, the dishwasher warranty ends on 30 November. Its purchase receipt and warranty terms are saved together, so you can review the cover before it expires.",
    source: "Dishwasher · Warranty terms",
  },
  {
    q: "Where is my washing machine receipt?",
    a: "The washing machine receipt is attached to its Digital Passport in Utility room. The recorded purchase is £649 on 12 March 2026.",
    source: "Bosch washing machine · Purchase receipt",
  },
  {
    q: "When is my car insurance due?",
    a: "The example car insurance renews on 8 February 2027. The policy is linked to the vehicle record, ready for you to review.",
    source: "Family vehicle · Insurance policy",
  },
  {
    q: "When does my boiler need servicing?",
    a: "The saved example service interval points to 10 May 2027. Check the supplier requirements and arrange the service with a qualified engineer.",
    source: "Boiler · Service record",
  },
  {
    q: "What belongings have I recorded?",
    a: "This illustrative home has a washing machine, dishwasher, television and family car. Each record connects its location, recorded value and supporting documents.",
    source: "Home · Asset records",
  },
];
const businessQuestions = [
  {
    q: "Which equipment needs attention?",
    a: "The example café espresso machine has a service review due in January. The refrigeration unit also has a warranty ending in December. Review their records and decide the next steps.",
    source: "High Street Café · Equipment records",
  },
  {
    q: "What warranties are expiring?",
    a: "The example refrigeration warranty ends on 14 December 2026. The supplier invoice and warranty document are attached to the equipment passport.",
    source: "Refrigeration unit · Warranty certificate",
  },
  {
    q: "Which assets have missing documents?",
    a: "The example office printer has no purchase invoice attached. Add the invoice to its evidence collection when it is available.",
    source: "Office printer · Evidence collection",
  },
  {
    q: "What is our recorded equipment value?",
    a: "The equipment in this illustrative workspace has a total recorded purchase value of £18,450. Recorded values are not professional valuations or replacement-cost estimates.",
    source: "Business workspace · Recorded values",
  },
  {
    q: "Which renewals are approaching?",
    a: "The example premises insurance renews on 1 February 2027, and the equipment service agreement ends on 14 January. Their documents are saved with the relevant records.",
    source: "Business workspace · Renewal records",
  },
  {
    q: "What is at our other locations?",
    a: "The example Riverside location contains a workstation, printer and meeting-room display. Switch the location filter to review the records for that site.",
    source: "Riverside · Location asset records",
  },
];
export function SeraDemo({ initial = "personal" }: { initial?: "personal" | "business" }) {
  const [mode, setMode] = useState<"personal" | "business" | "enterprise">(initial);
  const [visibleText, setVisibleText] = useState(1000);
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(false);
  const questions = mode === "personal" ? personalQuestions : businessQuestions;
  const current = questions[index] ?? questions[0];
  useEffect(() => {
    if (!typing) return;
    setVisibleText(0);
    const t = setTimeout(() => setTyping(false), 650);
    return () => clearTimeout(t);
  }, [typing, index, mode]);
  useEffect(() => {
    if (typing || !current || visibleText >= current.a.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisibleText(current.a.length); return; }
    const t = setTimeout(() => setVisibleText((n) => n + 12), 24);
    return () => clearTimeout(t);
  }, [typing, current, visibleText]);
  if (!current) return null;
  return (
    <section className="mk-tint" id="sera-demo">
      <div className="mk-container mk-section mk-sera">
        <div>
          <p className="mk-eyebrow">Meet Sera AI</p>
          <h2>
            Stop searching.
            <br />
            <em>Start asking.</em>
          </h2>
          <p className="mk-lead">
            Your receipts, records and important dates — without the hunt through folders. Ask Sera
            about what you have saved, in everyday language.
          </p>
          <div className="mk-tabs" role="group" aria-label="Assistant audience">
            {(["personal", "business", "enterprise"] as const).map((m) => (
              <Button
                key={m}
                variant="outline"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setIndex(0);
                  setTyping(true);
                }}
              >
                {m === "personal" ? "Personal Assistant" : m === "business" ? "Business Assistant" : "Enterprise Illustration"}
              </Button>
            ))}
          </div>
          <Button asChild variant="link">
            <Link to="/sera">
              Discover Sera AI
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mk-sera-chat">
          <div className="mk-sera-title">
            <span className="mk-sera-avatar">
              <Sparkles className="size-5" />
            </span>
            <div>
              <strong>Sera</strong>
              <small>Interactive demonstration · Scripted responses</small>
            </div>
          </div>
          <div className="mk-chat-question">{current.q}</div>
          <div className="mk-chat-answer" aria-live="polite">
            {typing ? <span className="mk-typing-dots" aria-label="Sera is thinking"><i /><i /><i /></span> : <span aria-hidden="true">{current.a.slice(0, visibleText)}</span>}<span className="sr-only">{typing ? "Sera is thinking" : current.a}</span>
          </div>
          {!typing && (
            <div className="mk-chat-source">
              <FileText className="size-4 text-primary" />
              <span>{current.source}</span>
              <Check className="ml-auto size-4 text-primary" />
            </div>
          )}
          {!typing && <div className="mk-sera-context"><img src={mode === "personal" ? index === 2 ? photos.vehicle : photos.appliance : photos.coffee} alt="Relevant example asset" width="68" height="52" loading="lazy" /><div><strong>{current.source}</strong><small>Digital Passport · Evidence connected</small></div></div>}
          <div className="mk-questions">
            {questions.map((q, i) => (
              <Button
                variant="outline"
                key={q.q}
                onClick={() => {
                  setIndex(i);
                  setTyping(true);
                }}
                aria-pressed={index === i}
              >
                {q.q}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function RoiCalculator() {
  const defaultPrice = plans.find((p) => p.key === "business")?.monthly ?? 0;
  const [inputs, setInputs] = useState<RoiInputs>({
    employees: 3,
    hours: 4,
    hourlyCost: 25,
    reduction: 30,
    monthlyCost: defaultPrice,
    weeks: 48,
  });
  const results = calculateRoi(inputs);
  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(n);
  const fields: { key: keyof RoiInputs; label: string; max: number }[] = [
    { key: "employees", label: "Employees handling administration", max: 10000 },
    { key: "hours", label: "Hours per employee each week", max: 168 },
    { key: "hourlyCost", label: "Average hourly employee cost (£)", max: 1000 },
    { key: "reduction", label: "Assumed time reduction (%)", max: 100 },
    { key: "monthlyCost", label: "Illustrative monthly subscription (£)", max: 100000 },
    { key: "weeks", label: "Working weeks per year", max: 52 },
  ];
  return (
    <section className="mk-tint">
      <div className="mk-container mk-section">
        <p className="mk-eyebrow">A clearer view of business value</p>
        <h2>
          What is manual asset
          <br />
          administration costing you?
        </h2>
        <p className="mk-lead">
          Explore the potential value of time recovered. Your assumptions, not a promise of savings.
        </p>
        <div className="mk-roi">
          <div className="mk-roi-inputs">
            <div>
              {fields.map((f) => (
                <label key={f.key} htmlFor={`roi-${f.key}`}>
                  {f.label}
                  <Input
                    id={`roi-${f.key}`}
                    type="number"
                    min="0"
                    max={f.max}
                    step={f.key === "hourlyCost" || f.key === "monthlyCost" ? "0.01" : "1"}
                    value={inputs[f.key]}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        [f.key]: Math.min(f.max, Math.max(0, Number(e.target.value))),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="mk-disclaimer">
              Illustrative estimate based on your inputs. Actual results depend on implementation,
              adoption and workflow performance. Staff capacity released does not necessarily
              represent direct cash savings.
            </p>
          </div>
          <div className="mk-roi-results" aria-live="polite">
            <p className="mk-eyebrow">Estimated annual net capacity benefit</p>
            <p className="mk-roi-total">{money(results.netBenefit)}</p>
            <p className="text-xs text-muted-foreground mb-5">
              Productivity value less annual subscription cost
            </p>
            <dl>
              <div>
                <dt>Current annual administration</dt>
                <dd>{results.annualHours.toLocaleString("en-GB")} hours</dd>
              </div>
              <div>
                <dt>Current annual administration cost</dt>
                <dd>{money(results.annualCost)}</dd>
              </div>
              <div>
                <dt>Potential hours recovered</dt>
                <dd>
                  {results.recoveredHours.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{" "}
                  hours
                </dd>
              </div>
              <div>
                <dt>Potential annual productivity value</dt>
                <dd>{money(results.productivityValue)}</dd>
              </div>
              <div>
                <dt>Annual subscription cost</dt>
                <dd>{money(results.subscriptionCost)}</dd>
              </div>
            </dl>
            <p className="text-xs mt-6">Current administration time</p>
            <div className="mk-roi-bar">
              <div style={{ width: "100%" }} />
            </div>
            <p className="text-xs">Remaining administration time</p>
            <div className="mk-roi-bar">
              <div style={{ width: `${100 - inputs.reduction}%` }} />
            </div>
            <Button asChild className="w-full mt-4">
              <Link to="/contact">
                Explore the value for your business
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
export function MarketingPricing({
  initial = "individual",
  comparison = false,
}: {
  initial?: Audience;
  comparison?: boolean;
}) {
  const [audience, setAudience] = useState<Audience>(initial);
  const [yearly, setYearly] = useState(false);
  const Heading = comparison ? "h1" : "h2";
  const PlanHeading = comparison ? "h2" : "h3";
  const catalogue = usePublishedPlans();
  const inactive = useInactivePlans();
  const list = (catalogue.data ?? plans).filter(
    (p) => p.audience === audience && !inactive.has(p.key),
  );
  return (
    <section className="mk-container mk-section" id="plans">
      <p className="mk-eyebrow">Plans for your world</p>
      <Heading>
        Invest a little.
        <br />
        Stay in control of much more.
      </Heading>
      <p className="mk-lead">
        Start with what matters today. Choose more space and capabilities as your needs grow.
      </p>
      <div className="mk-pricing-controls">
        <div className="mk-tabs" role="group" aria-label="Pricing audience">
          {(["individual", "business", "enterprise"] as const).map((a) => (
            <Button
              key={a}
              variant="outline"
              aria-pressed={audience === a}
              onClick={() => setAudience(a)}
            >
              {a === "individual" ? "Individual" : a === "business" ? "Business" : "Enterprise & White-label"}
            </Button>
          ))}
        </div>
        {audience !== "enterprise" && (
          <div className="mk-tabs" role="group" aria-label="Billing period">
            <Button variant="outline" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              Monthly
            </Button>
            <Button variant="outline" aria-pressed={yearly} onClick={() => setYearly(true)}>
              Yearly
            </Button>
          </div>
        )}
      </div>
      {catalogue.isPending && (
        <p role="status" className="pb-6 text-xs text-muted-foreground">
          Showing the existing plan catalogue while checking published updates…
        </p>
      )}
      {catalogue.isError && (
        <div role="alert" className="mk-catalogue-notice">
          <p>
            Published updates are unavailable. Existing catalogue prices are shown below; confirm
            the current plan in your account before subscribing.
          </p>
          <Button variant="outline" onClick={() => void catalogue.refetch()} className="mt-3">
            Try again
          </Button>
        </div>
      )}
      <div className="mk-price-grid">
        {list.map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          return (
            <article key={p.key} className={`mk-price ${p.badge ? "mk-price-featured" : ""}`}>
              {p.badge && <span className="mk-price-badge">{p.badge.toLowerCase().includes("popular") ? "Recommended" : p.badge}</span>}
              <PlanHeading>{p.name}</PlanHeading>
              <p className="mt-3">{p.positioning}</p>
              <p className="mk-price-number" key={String(price)}>{price === null ? "Custom" : `£${price.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`}<small>{price ? yearly ? "/year" : "/month" : ""}</small></p>
              <div className="mk-price-alternative">{p.monthly && p.yearly ? yearly ? `£${(p.yearly / 12).toFixed(2)}/month · save £${(p.monthly * 12 - p.yearly).toFixed(2)}/year` : `or £${p.yearly}/year` : price === 0 ? "Free forever" : "Tailored contract"}</div>
              <div className="mk-price-allowances">{[[Users, p.cap.users], [MapPin, p.cap.places], [Package, p.cap.assets], [HardDrive, p.cap.storage]].map(([Icon, text], i) => { const I = Icon as typeof Users; return <span key={i}><I />{text as string}</span>; })}</div>
              <p className="mk-price-best"><strong>Best for:</strong> {p.bestFor}</p>
              <p className="mk-price-outcome">{p.outcome}</p>
              <ul>{p.benefits.slice(0, 5).map((benefit) => <li key={benefit}><Check className="size-3.5 text-primary" />{benefit}</li>)}</ul>
              <details><summary>See everything included</summary><ul>{p.benefits.slice(5).map((benefit) => <li key={benefit}><Check className="size-3.5 text-primary" />{benefit}</li>)}{[p.cap.docs, p.cap.captures, p.cap.sera, p.support].filter(Boolean).map((c) => <li key={c}><Check className="size-3.5 text-primary" />{c}</li>)}</ul></details>
              {p.trialDays && <p className="mb-3">{p.trialDays}-day Business Starter trial</p>}
              <Button asChild variant={p.badge ? "default" : "outline"}>
                <Link to={price === null ? "/contact" : "/auth"}>
                  {price === null
                    ? "Discuss your needs"
                    : p.trialDays
                      ? "Start 14-day trial"
                      : price === 0
                        ? "Start Free"
                        : `Choose ${p.name}`}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
      {comparison && list.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-6">Compare current features and allowances</h3>
          <CompareTable list={list} />
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-4 mt-6">
        <p className="mk-demo-label">
          Prices in GBP. Only Business Starter includes a 14-day trial.
        </p>
        {!comparison && (
          <Button asChild variant="link">
            <Link to="/pricing">
              Compare all plans
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
