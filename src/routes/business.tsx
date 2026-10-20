import { createFileRoute } from "@tanstack/react-router";
import {
  MapPin,
  Package,
  FileText,
  ShieldCheck,
  Users,
  Repeat,
  Truck,
  BarChart3,
  Lock,
} from "lucide-react";
import {
  SiteShell,
  PageHero,
  FeatureGrid,
  Steps,
  UseCases,
  Checklist,
  FAQ,
  CTA,
  FeedCard,
} from "@/components/hv/Site";

const t = "MatrixKeep for Business — assets, warranties and renewals under control";
const d =
  "Every asset, document, warranty, contract and renewal across every location — under control.";
export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: t },
      { name: "description", content: d },
      { property: "og:title", content: t },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="For SMEs & growing teams"
        title="Every asset, every site,"
        accent="under control."
        lead={d}
        visual={
          <FeedCard
            title="Renewals radar"
            rows={[
              ["Coffee machine warranty", "12 days"],
              ["Fire safety check", "Overdue"],
              ["Van insurance — Leeds", "34 days"],
              ["Card terminal lease", "Q1"],
              ["Laptop fleet audit", "Done"],
            ]}
          />
        }
      />
      <FeatureGrid
        title="Run operations, not spreadsheets."
        lead="One place for equipment, paperwork and dates across all your locations."
        items={[
          {
            icon: MapPin,
            t: "Locations",
            d: "Shops, offices, clinics or sites — each with its own assets and records.",
          },
          {
            icon: Package,
            t: "Asset register",
            d: "Equipment, IT, furniture and tools with photos, serials, values and owners.",
          },
          {
            icon: ShieldCheck,
            t: "Warranty & renewal intelligence",
            d: "Warranties, contracts, licences and policies surfaced before they lapse.",
          },
          {
            icon: FileText,
            t: "Invoices & documents",
            d: "Invoices, manuals and certificates read by AI and linked to the right asset.",
          },
          {
            icon: Truck,
            t: "Fleet",
            d: "Vans and cars with MOT, tax, servicing and insurance tracked.",
          },
          {
            icon: Users,
            t: "Team & roles",
            d: "Owner, Admin, Manager, Staff and Viewer roles for your people.",
          },
        ]}
      />
      <Steps
        steps={[
          ["Add your locations", "Set up each site in minutes."],
          ["Capture assets", "Scan equipment, upload invoices or import in bulk."],
          ["Stay ahead", "Weekly digests of what expires, breaks or needs servicing."],
        ]}
      />
      <UseCases
        title="Trusted by every kind of business"
        items={[
          "Retail shops",
          "Restaurants & cafés",
          "Clinics & dental",
          "Schools",
          "Garages",
          "Construction",
          "Property managers",
          "Charities",
          "Offices",
          "Warehouses",
          "Hospitality",
          "Manufacturers",
        ]}
      />
      <Checklist
        title="Why teams switch to MatrixKeep."
        items={[
          "Stop paying for expired-warranty repairs",
          "Never miss an insurance, lease or licence renewal",
          "Audit-ready evidence for every asset",
          "Separate workspaces for each business you run",
        ]}
        side={
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                [BarChart3, "Asset value by site"],
                [Repeat, "Renewal calendar"],
                [Lock, "Role-based access"],
                [FileText, "Evidence vault"],
              ] as const
            ).map(([I, l]) => (
              <div key={l} className="rounded-3xl border bg-card p-6 shadow-soft">
                <I className="h-6 w-6 text-primary" />
                <p className="mt-4 font-semibold">{l}</p>
              </div>
            ))}
          </div>
        }
      />
      <FAQ
        items={[
          [
            "Can I manage more than one business?",
            "Yes. Create a workspace for each business and switch between them.",
          ],
          [
            "Can my staff log in?",
            "You can add your team and give each person a role. Individual staff sign-in is on the way.",
          ],
          [
            "Can I import my existing asset list?",
            "You can add records quickly with Add anything; bulk import is planned.",
          ],
          [
            "Is my data separate from my personal home?",
            "Yes. Business and home workspaces keep their records apart.",
          ],
        ]}
      />
      <CTA
        title="Put your whole operation on one passport."
        lead="Start free, add your first location today."
      />
    </SiteShell>
  );
}
