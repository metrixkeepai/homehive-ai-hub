import { createFileRoute } from "@tanstack/react-router";
import { Camera, Receipt, ShieldCheck, Wrench, Car, Users, Umbrella, CalendarClock, FileText } from "lucide-react";
import { SiteShell, PageHero, FeatureGrid, Steps, UseCases, Checklist, FAQ, CTA, FeedCard } from "@/components/hv/Site";

const t = "MatrixKeep for Individuals — your home, remembered by AI";
const d = "Your home, belongings, receipts, warranties and important dates — remembered by AI.";
export const Route = createFileRoute("/individual")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Page,
});

function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="For homes & families" title="Your home," accent="remembered." lead={d}
        visual={<FeedCard title="Sera · this week" rows={[["Kitchen scanned", "14 items"], ["Dyson receipt matched", "£399"], ["TV warranty ends", "26 days"], ["Boiler service due", "Nov"], ["MOT reminder set", "Golf"]]} />} />
      <FeatureGrid title="Everything you own, in one passport." lead="Snap it, scan it or forward it. MatrixKeep files it and watches what comes next."
        items={[
          { icon: Camera, t: "Scan a room", d: "Point your camera at a room and AI lists the items in it, with photos as proof." },
          { icon: Receipt, t: "Receipts that file themselves", d: "Photograph a receipt or forward an email. The item, price and date are linked." },
          { icon: ShieldCheck, t: "Warranty watch", d: "See every warranty and get told before cover ends — not after." },
          { icon: Wrench, t: "Maintenance memory", d: "Boiler services, filters and gutters, remembered on schedule." },
          { icon: Car, t: "Vehicles", d: "MOT, tax, servicing and insurance renewals for every car in the family." },
          { icon: Umbrella, t: "Claim-ready evidence", d: "Photos, values and proof of ownership gathered in one place if the worst happens." },
        ]} />
      <Steps steps={[["Capture it once", "Photo, receipt, voice note or email — whatever is quickest."], ["AI organises it", "Items, rooms, documents and dates are linked automatically."], ["Know what’s next", "Sera tells you about renewals, expiries and jobs before they’re due."]]} />
      <UseCases title="Built for real life" items={["Homeowners", "Renters", "Families", "First-time buyers", "Landlords with one property", "Car owners", "Collectors", "Moving house", "Insurance claims"]} />
      <Checklist title="Share the load with your household." items={["Invite a partner or family members", "Give guests and tradespeople limited, time-boxed access", "Children see only what you choose", "Everyone gets the same reminders"]}
        side={<div className="grid grid-cols-2 gap-4">{[[Users, "6 members"], [CalendarClock, "Shared reminders"], [FileText, "One document vault"], [ShieldCheck, "Private by default"]].map(([I, l]: any) => <div key={l} className="rounded-3xl border bg-card p-6 shadow-soft"><I className="h-6 w-6 text-primary" /><p className="mt-4 font-semibold">{l}</p></div>)}</div>} />
      <FAQ items={[["Is there a free plan?", "Yes. You can start free with one home and upgrade any time."], ["Do I need to type everything in?", "No. Take photos, scan receipts or speak, and the AI fills in the details for you to check."], ["Who can see my records?", "Only you and the people you invite. Files are stored privately."], ["Can I use it if I rent?", "Yes — track your own belongings, receipts and warranties wherever you live."]]} />
      <CTA title="Give your home a memory." lead="Start free in under a minute. No card needed." />
    </SiteShell>
  );
}
