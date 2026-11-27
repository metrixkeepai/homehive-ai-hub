import { IntelligenceShowcase } from "./Living";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Receipt,
  ShieldCheck,
  CalendarClock,
  Wrench,
  FileText,
  ClipboardCheck,
  Package,
  Car,
  Users,
  Sparkles,
  Camera,
  Brain,
  Link2,
  Eye,
  Check,
  Minus,
  Lock,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, Steps, FeatureGrid } from "@/components/hv/Site";
import { industries, useCases } from "@/components/hv/siteContent";
import { photos, storyPhoto } from "./media";
export function Problems() {
  const items = [
    {
      icon: Receipt,
      t: "The receipt you cannot find.",
      d: "Keep purchase evidence connected to the right asset.",
    },
    {
      icon: ShieldCheck,
      t: "The warranty that quietly expired.",
      d: "Review recorded cover and expiry dates before a repair.",
    },
    {
      icon: CalendarClock,
      t: "The renewal nobody remembered.",
      d: "Bring contracts, insurance and important dates into one view.",
    },
    {
      icon: Wrench,
      t: "Equipment that needs attention.",
      d: "Keep service intervals, supplier details and maintenance history together.",
    },
    {
      icon: FileText,
      t: "Documents scattered everywhere.",
      d: "Connect invoices, manuals and policies to what they belong to.",
    },
    {
      icon: ClipboardCheck,
      t: "The inspection record that is missing.",
      d: "Organise certificates and supporting evidence for professional review.",
    },
  ];
  return (
    <section className="mk-container mk-section">
      <Reveal>
        <p className="mk-eyebrow">Small oversights. Real consequences.</p>
        <h2>
          What you forget can cost you
          <br />
          more than you think.
        </h2>
        <p className="mk-lead">
          A lost receipt. A missed renewal. A service record nobody can find. The information is
          there — just not when you need it.
        </p>
      </Reveal>
      <div className="mk-problems mt-10">
        <div className="mk-problem-photo">
          <img
            src={photos.family}
            alt="A family reviewing a household appliance receipt in their kitchen"
            width="429"
            height="407"
            loading="lazy"
          />
          <div className="mk-float-note">
            <FileText className="size-5 text-primary shrink-0" />
            <div>
              <strong>Found. Connected. Ready.</strong>
              <p>Purchase receipt → Appliance → Warranty record</p>
              <p>Illustrative product preview</p>
            </div>
          </div>
        </div>
        <div className="mk-problem-list">
          {items.map((f) => (
            <article key={f.t}>
              <f.icon />
              <div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <p className="mt-8 text-sm font-semibold text-primary">
        Stop searching. Stop guessing. Start staying ahead.
      </p>
    </section>
  );
}
export function Worlds() {
  return (
    <section className="mk-tint">
      <div className="mk-container mk-section">
        <Reveal>
          <p className="mk-eyebrow">One platform, built for your world</p>
          <h2>
            Different lives. Different businesses.
            <br />
            One intelligent platform.
          </h2>
        </Reveal>
        <div className="mk-worlds mt-10">
          {(
            [
              {
                to: "/individual",
                tag: "Individuals & Families",
                title: "Your home. Your belongings. Your peace of mind.",
                text: "Protect the things you have worked hard for. Keep belongings, receipts, warranties and important dates in one digital workspace.",
                image: photos.family,
              },
              {
                to: "/business",
                tag: "Small & Medium Businesses",
                title: "Run your business. Not your paperwork.",
                text: "Bring equipment, locations, invoices, service records and renewals together without relying on disconnected spreadsheets.",
                image: photos.cafe,
              },
              {
                to: "/enterprise",
                tag: "Enterprise",
                title: "Greater visibility. Smarter operations.",
                text: "Explore how connected asset records, evidence and human oversight can support complex organisational requirements.",
                image: photos.enterprise,
              },
            ] as const
          ).map((a) => (
            <Reveal key={a.to}>
              <article>
                <img
                  src={a.image}
                  alt={
                    a.tag === "Enterprise"
                      ? "Business operations team collaborating"
                      : a.tag === "Small & Medium Businesses"
                        ? "Independent café owner beside equipment"
                        : "Family organising household information"
                  }
                  width="429"
                  height="407"
                  loading="lazy"
                />
                <p className="mk-eyebrow">{a.tag}</p>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
                <Link to={a.to}>
                  Explore {a.tag}
                  <ArrowRight className="size-4" />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
export const capabilities = [
  {
    icon: Package,
    t: "Asset Intelligence",
    d: "Know what you own, where it is and the purchase value you have recorded.",
  },
  {
    icon: ShieldCheck,
    t: "Warranty Intelligence",
    d: "Keep cover dates and purchase evidence accessible when you need them.",
  },
  {
    icon: FileText,
    t: "Intelligent Evidence Vault",
    d: "Connect receipts, certificates, invoices and manuals to their assets.",
  },
  {
    icon: CalendarClock,
    t: "Renewal Intelligence",
    d: "Review insurance, contract and licence dates before they need attention.",
  },
  {
    icon: Wrench,
    t: "Maintenance Intelligence",
    d: "Keep saved service requirements and maintenance history in context.",
  },
  {
    icon: Car,
    t: "Vehicle & Fleet Records",
    d: "Organise vehicle details, MOT records, insurance and service evidence.",
  },
  {
    icon: Share2,
    t: "Digital Asset Passports",
    d: "Connect identity, evidence and lifecycle history in a shareable report.",
  },
  {
    icon: Users,
    t: "Family & Team Workspaces",
    d: "Organise household or business information and recorded responsibilities.",
  },
  {
    icon: Sparkles,
    t: "Sera AI Assistant",
    d: "Ask questions about saved records without searching through folders.",
  },
  {
    icon: ClipboardCheck,
    t: "Compliance Evidence",
    d: "Organise supporting documents for human review, not automated certification.",
  },
];
export function Capabilities() {
  const [index, setIndex] = useState(0);
  const current = capabilities[index] ?? capabilities[0];
  if (!current) return null;
  return (
    <section className="mk-container mk-section">
      <div className="mk-section-head">
        <div>
          <p className="mk-eyebrow">The connected capability ecosystem</p>
          <h2>
            Everything connected.
            <br />
            Everything easier to manage.
          </h2>
        </div>
        <p className="mk-lead">
          One platform built around your assets, not another collection of disconnected folders.
        </p>
      </div>
      <div className="mk-split">
        <div className="mk-problem-photo">
          <img
            src={
              index === 5
                ? photos.vehicle
                : index === 4
                  ? photos.coffee
                  : index === 9
                    ? photos.dental
                    : photos.it
            }
            alt={current.t + " example environment"}
            width="627"
            height="627"
            loading="lazy"
          />
          <div className="mk-float-note">
            <current.icon className="size-5 text-primary shrink-0" />
            <div>
              <strong>{current.t}</strong>
              <p>{current.d}</p>
              <p>Illustrative product preview</p>
            </div>
          </div>
        </div>
        <div className="mk-capability-list">
          {capabilities.map((c, i) => (
            <Button
              key={c.t}
              variant="ghost"
              className="w-full justify-start border-b border-border rounded-none! py-3! h-auto!"
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              <c.icon className="size-4 text-primary" />
              <span className="flex-1 text-left">{c.t}</span>
              {index === i ? <ArrowRight className="size-4 text-primary" /> : null}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Intelligence() {
  return <IntelligenceShowcase />;
}
export function Journey() {
  return (
    <>
      <section className="mk-container pt-16">
        <p className="mk-eyebrow">How MatrixKeep works</p>
        <h2>
          From real-world assets
          <br />
          to intelligent digital records.
        </h2>
      </section>
      <Steps
        steps={[
          ["Capture", "Take a photo, upload a document or use a supported capture method."],
          ["Understand", "AI-assisted processing helps extract relevant details for you to check."],
          ["Organise", "Connect information to its property, vehicle, equipment or asset."],
          ["Stay informed", "Review saved dates, available insights and calendar reminders."],
          ["Take action", "Find the evidence and decide what needs to happen next."],
        ]}
      />
    </>
  );
}
export function UseCaseExplorer() {
  const [filter, setFilter] = useState("Personal");
  const filtered = useCases.filter((s) =>
    filter === "Personal"
      ? /home|warranty|insurance|passport/.test(s.slug)
      : filter === "Vehicles"
        ? /vehicle/.test(s.slug)
        : filter === "Property"
          ? /property|passport|multi-location/.test(s.slug)
          : filter === "Enterprise"
            ? /multi-location|compliance|equipment|business/.test(s.slug)
            : /business|renewal|equipment|multi-location|compliance/.test(s.slug),
  );
  return (
    <section className="mk-container mk-section">
      <p className="mk-eyebrow">Real-world use cases</p>
      <h2>Built for the moments that matter.</h2>
      <div className="mk-tabs" role="group" aria-label="Use case audience">
        {["Personal", "Business", "Property", "Vehicles", "Enterprise"].map((x) => (
          <Button
            key={x}
            variant="outline"
            aria-pressed={filter === x}
            onClick={() => setFilter(x)}
          >
            {x}
          </Button>
        ))}
      </div>
      <div className="mk-use-grid">
        {filtered.slice(0, 6).map((s) => (
          <Link
            className="mk-use-card"
            key={s.slug}
            to="/use-cases/$slug"
            params={{ slug: s.slug }}
          >
            <img
              src={storyPhoto(s.slug)}
              alt={s.t + " example"}
              width="627"
              height="627"
              loading="lazy"
            />
            <div>
              <h3>{s.t}</h3>
              <p>
                {s.pains[0]}. {s.short}
              </p>
              <span>
                Explore this use case
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function IndustryShowcase() {
  return (
    <section className="mk-tint">
      <div className="mk-container mk-section">
        <div className="mk-section-head">
          <div>
            <p className="mk-eyebrow">Industry solutions</p>
            <h2>
              One platform.
              <br />
              Endless practical applications.
            </h2>
          </div>
          <Button asChild variant="link">
            <Link to="/industries">
              Explore all industries
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mk-industries">
          {industries.map((s) => (
            <Link key={s.slug} to="/industries/$slug" params={{ slug: s.slug }}>
              <img
                src={storyPhoto(s.slug)}
                alt={s.t + " environment and equipment"}
                width="429"
                height="407"
                loading="lazy"
              />
              <h3>
                {s.t}
                <ArrowRight className="inline ml-2 size-3" />
              </h3>
              <p>{s.short}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Comparison() {
  const rows = [
    [
      "Structured asset records",
      "Can be configured",
      "Files and folders",
      "Limited",
      "Connected records",
    ],
    [
      "AI-assisted capture",
      "Depends on setup",
      "Depends on provider",
      "Depends on provider",
      "Supported capture methods",
    ],
    [
      "Connected evidence",
      "Manual links",
      "Manual organisation",
      "Usually separate",
      "Linked to assets",
    ],
    [
      "Warranty & maintenance",
      "Manual tracking",
      "Document storage",
      "Date reminders",
      "Records + evidence + dates",
    ],
    [
      "Digital Asset Passports",
      "Custom assembly",
      "Custom assembly",
      "Not the primary purpose",
      "Export & controlled sharing",
    ],
    [
      "Conversational assistance",
      "Depends on provider",
      "Depends on provider",
      "Depends on provider",
      "Sera for saved records",
    ],
  ];
  return (
    <section className="mk-container mk-section">
      <p className="mk-eyebrow">Why MatrixKeep</p>
      <h2>
        A folder stores information.
        <br />
        MatrixKeep helps you understand it.
      </h2>
      <div className="mk-compare">
        <table>
          <caption className="text-left text-xs text-muted-foreground mb-4">
            Typical approaches vary by provider and configuration.
          </caption>
          <thead>
            <tr>
              {["Capability", "Spreadsheets", "Cloud storage", "Reminder apps", "MatrixKeep"].map(
                (x) => (
                  <th scope="col" key={x}>
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((x, i) =>
                  i === 0 ? (
                    <th scope="row" key={x} className="bg-transparent!">
                      {x}
                    </th>
                  ) : (
                    <td key={i}>{x}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function Trust() {
  return (
    <section className="mk-tint">
      <div className="mk-container mk-section mk-split">
        <div>
          <p className="mk-eyebrow">Privacy & responsible AI</p>
          <h2>
            Your information matters.
            <br />
            Protecting it matters even more.
          </h2>
          <p className="mk-lead">
            Private records. Controlled evidence access. Sharing you choose. AI that supports
            decisions, while keeping people in control.
          </p>
          <div className="mk-actions">
            <Button asChild variant="outline">
              <Link to="/security">
                Security & Privacy
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="link">
              <Link to="/privacy">Privacy Policy</Link>
            </Button>
          </div>
        </div>
        <div className="mk-feature-grid grid-cols-2! mt-0!">
          {[
            { icon: Lock, t: "Secure authentication", d: "Existing email and Google sign-in." },
            { icon: ShieldCheck, t: "Scoped records", d: "Account and workspace boundaries." },
            {
              icon: Share2,
              t: "Controlled sharing",
              d: "Selected passport snapshots with expiry.",
            },
            { icon: Eye, t: "Human oversight", d: "Review AI output against your evidence." },
          ].map((f) => (
            <div className="mk-feature" key={f.t}>
              <f.icon className="size-6 text-primary" />
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
