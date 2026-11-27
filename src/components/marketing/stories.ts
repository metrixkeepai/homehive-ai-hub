import type { Story } from "@/components/hv/siteContent";
import type { ScrollStoryData } from "./ScrollStory";
import { photos, storyPhoto, scenes } from "./media";

/** Page-specific illustrative scroll stories. Records are illustrative, never account data. */
type Extra = { headline: string; asset: string; fields: [string, string][]; insight: string; nodes?: string[] };

export const industryExtras: Record<string, Extra> = {
  hospitality: { headline: "Keep your kitchen running. Keep your records connected.", asset: "Combination oven", fields: [["Asset", "Combi oven CX-10"], ["Recorded value", "£7,200"], ["Location", "Main kitchen"], ["Service", "Quarterly"]], insight: "The combi oven service is due in 12 days. The engineer report from March is attached to its passport.", nodes: ["Espresso machine", "Walk-in chiller", "Combi oven", "Dishwasher"] },
  dental: { headline: "Care for your patients. Stay informed about your equipment.", asset: "Surgery autoclave", fields: [["Asset", "Class B autoclave"], ["Serial", "AC-30918"], ["Surgery", "Room 2"], ["Validation", "Weekly log"]], insight: "The autoclave warranty ends in 41 days. Its last validation certificate is ready to review.", nodes: ["Dental chair", "Autoclave", "X-ray unit", "Compressor"] },
  healthcare: { headline: "Important equipment. Important evidence. Intelligently organised.", asset: "Vaccine refrigerator", fields: [["Asset", "Pharmacy fridge"], ["Serial", "VF-2210"], ["Location", "Clinic store"], ["Logs", "Temperature evidence"]], insight: "The ultrasound service contract renews on 1 November. Review the notice period before it rolls over." },
  retail: { headline: "Every store. Every asset. One connected view.", asset: "Store chiller cabinet", fields: [["Asset", "Multideck chiller"], ["Store", "Leeds Central"], ["Recorded value", "£3,950"], ["Lease", "Equipment lease"]], insight: "Three stores have card terminal leases ending this quarter. Compare renewal terms before December.", nodes: ["Leeds Central", "York", "Harrogate", "Online hub"] },
  property: { headline: "Every property deserves a complete digital story.", asset: "Rental kitchen appliances", fields: [["Property", "14 Elm Grove"], ["Rooms", "6 recorded"], ["Gas safety", "Certificate saved"], ["Tenancy", "Renews July"]], insight: "The gas safety certificate for 14 Elm Grove expires in 30 days. Book the inspection before the tenant's renewal.", nodes: ["14 Elm Grove", "Flat 3B", "Mill House", "Unit 7"] },
  construction: { headline: "Know your tools. Protect your investment.", asset: "Site machinery", fields: [["Asset", "Mini excavator"], ["Serial", "EX-55120"], ["Site", "Riverside build"], ["Inspection", "LOLER due"]], insight: "The LOLER inspection for the mini excavator is due in 9 days. The last certificate is linked.", nodes: ["Excavator", "Van fleet", "Power tools", "Scaffold"] },
  manufacturing: { headline: "Greater visibility across the assets that keep you moving.", asset: "Production line press", fields: [["Asset", "Hydraulic press"], ["Line", "Line 2"], ["Recorded value", "£48,000"], ["Service", "Every 500 hours"]], insight: "Line 2 press reaches its recorded service interval next week. The manufacturer manual is attached.", nodes: ["Line 1", "Line 2", "Packaging", "Compressors"] },
  "warehousing-logistics": { headline: "Keep your equipment and operations in perspective.", asset: "Warehouse forklift", fields: [["Asset", "Counterbalance forklift"], ["Fleet ID", "FL-07"], ["Depot", "Midlands hub"], ["Thorough exam", "6-monthly"]], insight: "Forklift FL-07's thorough examination is due in 14 days. Two other depots have exams this month.", nodes: ["Midlands hub", "North depot", "Racking", "Forklift fleet"] },
  offices: { headline: "Build an organised business that remembers.", asset: "Office workstations", fields: [["Asset", "Design workstation"], ["Assigned", "Studio team"], ["Recorded value", "£1,850"], ["Licence", "Renews annually"]], insight: "Four laptops leave warranty next month and the office lease notice deadline is in 60 days.", nodes: ["Laptops", "Printers", "Contracts", "Office lease"] },
  education: { headline: "Intelligent records for every learning environment.", asset: "Classroom technology", fields: [["Asset", "Interactive display"], ["Room", "Science 3"], ["Recorded value", "£2,600"], ["PAT test", "Annual"]], insight: "Twelve classroom devices are due PAT testing before term starts. The supplier warranty covers two displays.", nodes: ["Science block", "Library", "Sports hall", "Devices"] },
  "automotive-fleet": { headline: "Every journey starts with knowing your vehicle.", asset: "Fleet van", fields: [["Vehicle", "Transit · KM23 XYZ"], ["MOT", "Due 18 March"], ["Insurance", "Fleet policy"], ["Service", "Every 12,000 miles"]], insight: "Van KM23 XYZ's MOT is due in 21 days and its insurance renews the following week.", nodes: ["Van 01", "Van 02", "Pool car", "Trailer"] },
  "homeowners-families": { headline: "Your home, your belongings, your peace of mind.", asset: "Family kitchen", fields: [["Asset", "American fridge freezer"], ["Recorded value", "£1,299"], ["Room", "Kitchen"], ["Warranty", "5 years"]], insight: "Your fridge freezer warranty runs until 2029. The receipt is already attached if you ever need to claim." },
};

export function storyForSlug(s: Story, kind: "industries" | "use-cases"): ScrollStoryData {
  const x = industryExtras[s.slug];
  const docs = s.feed.slice(0, 4) as [string, string][];
  return {
    eyebrow: kind === "industries" ? `${s.t} · living demonstration` : `${s.t} · how it works`,
    title: s.short,
    lead: s.lead,
    captions: [x ? `It starts with your ${x.asset.toLowerCase()}.` : "It starts with what you own.", ...s.steps.map(([t]) => `${t}.`)].slice(0, 4),
    image: storyPhoto(s.slug),
    asset: x?.asset ?? s.t,
    docs,
    fields: x?.fields ?? s.tracks.slice(0, 4).map((t, i) => [`Record ${i + 1}`, t] as [string, string]),
    passport: [x?.nodes ? "Connected workspace" : "Digital Passport", x?.asset ?? s.t],
    insight: x?.insight ?? `${docs[0]?.[0] ?? "A recorded date"}: ${docs[0]?.[1] ?? "ready to review"}. Sera keeps the evidence beside it.`,
    ...(x?.nodes ? { nodes: x.nodes } : {}),
    cta: kind === "industries" ? { label: "Explore Business Plans", to: "/pricing" } : { label: "Start Free", to: "/auth" },
  };
}

export const audienceStories: Record<"individual" | "business" | "enterprise", ScrollStoryData> = {
  individual: {
    eyebrow: "Your intelligent digital home",
    title: "From the things you own to the answers you need.",
    lead: "Watch one appliance become a connected record — receipt, warranty, maintenance and value in one place.",
    captions: ["You own it.", "MatrixKeep helps you organise it.", "Your evidence stays connected.", "Know what needs your attention."],
    image: photos.appliance,
    asset: "Washing machine · Utility room",
    docs: [["Purchase receipt", "£649 · Currys"], ["Product manual", "Model WM-8"], ["Warranty", "Until Jun 2027"], ["Maintenance", "Filter clean · monthly"]],
    fields: [["Product", "Washing machine WM-8"], ["Recorded value", "£649"], ["Room", "Utility room"], ["Evidence", "4 documents"]],
    passport: ["Digital Passport", "Washing machine · 4 records"],
    insight: "Your washing machine is still under warranty. The receipt and model number are ready if you need a repair.",
    nodes: ["Living room", "Kitchen", "Home office", "Family car"],
    cta: { label: "Start Free", to: "/auth" },
  },
  business: {
    eyebrow: "Living business intelligence",
    title: "From one asset to your entire operation.",
    lead: "One commercial asset becomes an intelligent record, then a location, then a clear view of your business.",
    captions: ["One asset.", "One intelligent record.", "One connected location.", "Your entire business, in perspective."],
    image: photos.cafe,
    asset: "Espresso machine · Café floor",
    docs: [["Supplier invoice", "£4,800 · Mar 2025"], ["Engineer report", "Serviced Oct"], ["Warranty", "Until Mar 2027"], ["Maintenance plan", "Descale quarterly"]],
    fields: [["Asset", "Espresso machine"], ["Recorded value", "£4,800"], ["Location", "Shoreditch café"], ["Next service", "January"]],
    passport: ["Shoreditch café", "18 assets · 42 records"],
    insight: "Two locations have maintenance due this month. The Camden chiller warranty ends in 30 days.",
    nodes: ["Shoreditch café", "Camden café", "Central kitchen", "Head office"],
    cta: { label: "Explore Business Plans", to: "/pricing" },
  },
  enterprise: {
    eyebrow: "Connected portfolio",
    title: "Every record, every location, one portfolio view.",
    lead: "Equipment records group into locations, locations connect into a portfolio, and responsibilities become visible.",
    captions: ["Individual equipment records.", "Grouped into operational locations.", "Connected into one portfolio.", "Responsibilities and reviews in view."],
    image: photos.enterprise,
    asset: "Regional operations",
    docs: [["Asset register", "1,240 records"], ["Service contracts", "38 suppliers"], ["Certificates", "Evidence linked"], ["Review owners", "Assigned by site"]],
    fields: [["Locations", "24 sites"], ["Assets", "1,240"], ["Evidence", "3,900 files"], ["Reviews", "Weekly"]],
    passport: ["Enterprise portfolio", "Illustrative · roadmap assurance"],
    insight: "Six sites have certificate reviews due this month. Advanced assurance reporting is a roadmap capability.",
    nodes: ["North region", "South region", "Data centre", "Head office"],
    cta: { label: "Book an Enterprise Consultation", to: "/contact" },
  },
};

const base = (o: Partial<ScrollStoryData> & Pick<ScrollStoryData, "eyebrow" | "title" | "lead" | "captions">): ScrollStoryData => ({
  image: photos.appliance,
  asset: "Household appliance",
  docs: [["Purchase receipt", "£849 · Mar 2025"], ["Manual", "Model RF-40"], ["Warranty", "Until Mar 2028"], ["Service", "Annual check"]],
  fields: [["Product", "Refrigerator RF-40"], ["Price", "£849"], ["Purchased", "12 March 2025"], ["Evidence", "3 documents"]],
  passport: ["Digital Passport", "Refrigerator · 4 records"],
  insight: "Your refrigerator warranty runs until March 2028. Everything you need for a claim is attached.",
  cta: { label: "Start Free", to: "/auth" },
  ...o,
});

export const productStories: Partial<Record<string, ScrollStoryData>> = {
  features: base({ eyebrow: "The platform", title: "Assets, evidence and dates — connected.", lead: "Scroll to see how MatrixKeep turns scattered information into one clear picture.", captions: ["Scattered information.", "Captured in seconds.", "Connected to the right asset.", "A clearer picture of everything."], nodes: ["Assets", "Documents", "Warranties", "Renewals"] }),
  "ai-agents": base({ eyebrow: "Assisted intelligence", title: "Watch the capabilities work together.", lead: "Vision, document, warranty and maintenance intelligence each add a layer to one record.", captions: ["Vision recognises the asset.", "Documents are interpreted.", "Warranty and dates are connected.", "Sera brings it together."], image: photos.it, asset: "Business workstation", nodes: ["Vision", "Documents", "Warranty", "Maintenance"] }),
  sera: base({ eyebrow: "Sera in context", title: "Don't search for answers. Ask for them.", lead: "A connected asset record becomes the context for an everyday question.", captions: ["You ask a question.", "Sera reads your saved records.", "The evidence is shown.", "You decide what's next."], insight: "Yes — your refrigerator is covered until March 2028. Here is the receipt and warranty." }),
  "digital-passport": base({ eyebrow: "Passport assembly", title: "Watch a Digital Passport assemble.", lead: "Identity, purchase, warranty and maintenance layers come together as you scroll.", captions: ["An asset.", "Its purchase evidence.", "Its warranty and service history.", "One shareable Digital Passport."], image: photos.coffee, asset: "Espresso machine", cta: { label: "Create Your First Digital Passport", to: "/auth" } }),
  "how-it-works": base({ eyebrow: "From photo to memory", title: "Capture. Understand. Organise. Act.", lead: "Every step from a photo to a useful record, controlled by your scroll.", captions: ["Take a photo.", "Add the receipt.", "Review what MatrixKeep found.", "Get reminded before it matters."], image: photos.vehicle, asset: "Family car", docs: [["Insurance", "Renews 4 May"], ["V5C logbook", "Saved"], ["MOT", "Due 18 Mar"], ["Service history", "6 visits"]], fields: [["Vehicle", "Family SUV"], ["MOT", "18 March"], ["Insurance", "4 May"], ["Evidence", "4 documents"]], passport: ["Vehicle Passport", "Family SUV · 4 records"], insight: "Your MOT is due in 21 days. Download a reminder or book now." }),
  about: base({ eyebrow: "Why we exist", title: "Important information deserves a better memory.", lead: "Every person and organisation depends on information that too easily disappears.", captions: ["Things we own.", "Information we lose.", "Context we rebuild.", "A memory that stays."], image: photos.family, asset: "A family home" }),
  partners: base({ eyebrow: "Partner ecosystem", title: "One connected asset ecosystem.", lead: "Insurers, retailers, service providers and property partners connect around the same trusted record.", captions: ["One asset record.", "Partners add evidence.", "Customers stay informed.", "Everyone works from the same story."], image: photos.world, asset: "Connected home", nodes: ["Retailers", "Insurers", "Service partners", "Property"], cta: { label: "Become a Partner", to: "/partners" } }),
};

export const indexStories = {
  industries: base({ eyebrow: "Across industries", title: "Individual assets assemble into one operation.", lead: "Different equipment, one intelligent approach to records and evidence.", captions: ["A coffee machine.", "A forklift.", "A dental chair.", "One intelligent approach."], image: photos.warehouse, asset: "Warehouse operations", nodes: ["Hospitality", "Logistics", "Dental", "Retail"], cta: { label: "Explore Business Plans", to: "/pricing" } }),
  "use-cases": base({ eyebrow: "Moments that matter", title: "When something matters, the record is ready.", lead: "Breakdowns, renewals, claims and moves — each moment is easier with connected records.", captions: ["Something breaks.", "The receipt is found.", "The warranty is checked.", "The claim is ready."], image: scenes["insurance-claims"] ?? photos.world }),
};
