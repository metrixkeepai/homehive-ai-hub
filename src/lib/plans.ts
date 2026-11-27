// Single source of truth for plans, prices, capacities and benefits (public pricing, in-app plans, billing).
export type Audience = "individual" | "business" | "enterprise";
export type Capacity = {
  users: string;
  places: string;
  assets: string;
  storage: string;
  docs: string;
  captures: string;
  sera: string;
};
export type PlanDef = {
  key: string;
  name: string;
  audience: Audience;
  monthly: number | null;
  yearly: number | null;
  positioning: string;
  bestFor: string;
  outcome: string;
  badge?: string;
  trialDays?: number;
  entitlements?: import("./entitlements").Entitlements;
  cap: Capacity;
  limits: { assets: number; users: number; places: number; docs: number };
  benefits: string[];
  agents: string[];
  support: string;
  locked?: string[];
};

const inf = Number.POSITIVE_INFINITY;
export const plans: PlanDef[] = [
  {
    key: "free",
    name: "Free",
    audience: "individual",
    monthly: 0,
    yearly: 0,
    positioning: "Start building your digital memory.",
    bestFor: "People trying MatrixKeep for the first time.",
    outcome: "Organise your first important items and experience MatrixKeep AI.",
    cap: {
      users: "1 user",
      places: "1 property",
      assets: "50 assets",
      storage: "500 MB",
      docs: "10 documents",
      captures: "5 AI captures/mo",
      sera: "10 Sera questions/mo",
    },
    limits: { assets: 50, users: 1, places: 1, docs: 10 },
    benefits: [
      "Basic photo capture",
      "Manual asset entry",
      "Receipt storage",
      "Warranty records",
      "Reminder tracking",
      "Evidence gallery",
      "Up to 3 rooms",
    ],
    agents: [],
    support: "Help centre",
    locked: [
      "Email import",
      "Vehicle passport",
      "Claim packs",
      "Advanced AI agents",
      "Family roles",
    ],
  },
  {
    key: "home",
    name: "Home",
    audience: "individual",
    monthly: 4.99,
    yearly: 49,
    badge: "Most popular",
    positioning: "Your whole home, remembered.",
    bestFor: "Individuals organising purchases, warranties, documents and maintenance.",
    outcome: "Stop hunting for receipts and wondering when something expires.",
    cap: {
      users: "2 members",
      places: "1 property",
      assets: "500 assets",
      storage: "10 GB",
      docs: "500 documents",
      captures: "100 AI captures/mo",
      sera: "300 Sera questions/mo",
    },
    limits: { assets: 500, users: 2, places: 1, docs: 500 },
    benefits: [
      "AI photo recognition",
      "AI receipt extraction",
      "Room scan",
      "Automatic warranty expiry",
      "Maintenance reminders",
      "Basic email import",
      "Asset & property passports",
      "Basic secure sharing",
    ],
    agents: ["Asset", "Receipt", "Document", "Warranty", "Maintenance"],
    support: "Standard support",
  },
  {
    key: "plus",
    name: "Home+",
    audience: "individual",
    monthly: 9.99,
    yearly: 99,
    positioning: "Complete household intelligence.",
    bestFor: "Property, vehicles, insurance evidence and larger households.",
    outcome: "Turn your household into a living AI-managed digital record.",
    cap: {
      users: "5 members",
      places: "2 properties",
      assets: "2,500 assets",
      storage: "50 GB",
      docs: "2,500 documents",
      captures: "500 AI captures/mo",
      sera: "1,500 Sera questions/mo",
    },
    limits: { assets: 2500, users: 5, places: 2, docs: 2500 },
    benefits: [
      "Advanced video room scan",
      "Vehicle passport & MOT tracking",
      "Insurance evidence inventory",
      "Claim pack generator",
      "Moving & Sell My Home modes",
      "Replacement value estimates",
      "Email import & matching",
      "Calendar integration",
    ],
    agents: ["Insurance", "Vehicle", "Property", "Value", "Moving", "Selling"],
    support: "Priority support",
  },
  {
    key: "family",
    name: "Family",
    audience: "individual",
    monthly: 14.99,
    yearly: 149,
    positioning: "One intelligent vault for the whole family.",
    bestFor: "Households with multiple people, properties or shared assets.",
    outcome: "Share what should be shared while keeping private information private.",
    cap: {
      users: "10 members",
      places: "5 properties",
      assets: "10,000 assets",
      storage: "200 GB",
      docs: "10,000 documents",
      captures: "1,500 AI captures/mo",
      sera: "5,000 Sera questions/mo",
    },
    limits: { assets: 10000, users: 10, places: 5, docs: 10000 },
    benefits: [
      "Family roles: owner, partner, adult, child, guest, provider",
      "Private member vaults",
      "Shared household assets",
      "Room & asset-level permissions",
      "Temporary access links",
      "Advanced audit history",
    ],
    agents: ["All household agents"],
    support: "Priority support",
  },
  {
    key: "business_starter",
    name: "Business Starter",
    audience: "business",
    monthly: 19,
    yearly: 190,
    trialDays: 14,
    badge: "14-day free trial",
    positioning: "Start organising your business properly.",
    bestFor: "Shops, small clinics, restaurants, offices, garages and consultancies.",
    outcome:
      "Replace spreadsheets, folders and forgotten renewal dates with one operational memory.",
    cap: {
      users: "3 users",
      places: "2 locations",
      assets: "250 assets",
      storage: "5 GB",
      docs: "500 documents",
      captures: "100 AI captures/mo",
      sera: "500 Sera questions/mo",
    },
    limits: { assets: 250, users: 3, places: 2, docs: 500 },
    benefits: [
      "Asset & equipment register",
      "Document vault & evidence viewer",
      "Receipts & invoices",
      "Warranty & renewal tracking",
      "Certificate tracking",
      "Team roles & basic permissions",
      "CSV export",
      "1 vehicle",
    ],
    agents: ["Asset", "Document", "Receipt", "Warranty", "Renewal", "Maintenance"],
    support: "Standard support",
  },
  {
    key: "business",
    name: "Business",
    audience: "business",
    monthly: 29,
    yearly: 290,
    badge: "Most popular",
    positioning: "Everything your growing business needs to remember.",
    bestFor: "Growing businesses with teams, branches and recurring obligations.",
    outcome: "Know what you own, where it is, what needs service and what expires next.",
    cap: {
      users: "10 users",
      places: "5 locations",
      assets: "1,500 assets",
      storage: "25 GB",
      docs: "5,000 documents",
      captures: "500 AI captures/mo",
      sera: "2,000 Sera questions/mo",
    },
    limits: { assets: 1500, users: 10, places: 5, docs: 5000 },
    benefits: [
      "Multi-location dashboard",
      "Departments & asset assignment",
      "10 vehicles",
      "Contracts, certificates & insurance",
      "Maintenance calendar",
      "Email & calendar integration",
      "Custom reminder rules",
      "Basic approval workflows",
    ],
    agents: ["Organisation", "Contract", "Vehicle", "Evidence"],
    support: "Standard support",
  },
  {
    key: "business_pro",
    name: "Business Pro",
    audience: "business",
    monthly: 79,
    yearly: 790,
    badge: "Recommended for multi-site",
    positioning: "AI operations for serious multi-location businesses.",
    bestFor: "Clinics, restaurant groups, schools, retail chains and operations teams.",
    outcome: "Give every branch one shared memory without losing local control.",
    cap: {
      users: "30 users",
      places: "25 locations",
      assets: "10,000 assets",
      storage: "100 GB",
      docs: "25,000 documents",
      captures: "2,000 AI captures/mo",
      sera: "10,000 Sera questions/mo",
    },
    limits: { assets: 10000, users: 30, places: 25, docs: 25000 },
    benefits: [
      "Department hierarchy & custom roles",
      "Advanced permission matrix",
      "Compliance evidence tracking",
      "Renewal automation",
      "Supplier records",
      "Location benchmarking & cost analytics",
      "Full audit logs",
      "Bulk imports & actions",
    ],
    agents: ["Compliance", "Insights", "Communication", "Security"],
    support: "Priority support",
  },
  {
    key: "business_scale",
    name: "Business Scale",
    audience: "business",
    monthly: 149,
    yearly: 1490,
    positioning: "Enterprise-grade control without enterprise complexity.",
    bestFor: "Larger SMEs, franchise groups and multi-site networks.",
    outcome: "Control assets, documents, renewals and teams from one command centre.",
    cap: {
      users: "100 users",
      places: "100 locations",
      assets: "50,000 assets",
      storage: "500 GB",
      docs: "100,000 documents",
      captures: "10,000 AI captures/mo",
      sera: "50,000 Sera questions/mo",
    },
    limits: { assets: 50000, users: 100, places: 100, docs: 100000 },
    benefits: [
      "Organisation hierarchy & business units",
      "Delegated location admin",
      "Advanced approval chains",
      "Advanced automation",
      "250 vehicles",
      "Everything in Business Pro",
    ],
    agents: ["All business agents"],
    support: "Priority support",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    audience: "enterprise",
    monthly: null,
    yearly: null,
    positioning: "Govern complex organisations at scale.",
    bestFor: "Banks, insurers, builders, public bodies and global operations.",
    outcome: "Contracted capacity, enterprise security and dedicated success.",
    cap: {
      users: "Contracted",
      places: "Contracted",
      assets: "Contracted",
      storage: "Custom",
      docs: "Custom",
      captures: "Custom AI allowance",
      sera: "Custom",
    },
    limits: { assets: inf, users: inf, places: inf, docs: inf },
    benefits: [
      "SSO / SAML / OIDC",
      "Enterprise RBAC & audit",
      "Custom data retention",
      "Licence pools & vouchers",
      "Enterprise API & webhooks",
      "Priority SLA & success manager",
    ],
    agents: ["All agents"],
    support: "Enterprise SLA",
  },
  {
    key: "whitelabel",
    name: "White-label",
    audience: "enterprise",
    monthly: null,
    yearly: null,
    positioning: "Offer MatrixKeep under your brand.",
    bestFor: "Builders, banks, insurers, retailers, telecoms and membership bodies.",
    outcome: "A branded digital passport for your customers.",
    cap: {
      users: "Programme",
      places: "Programme",
      assets: "Programme",
      storage: "Custom",
      docs: "Custom",
      captures: "Custom",
      sera: "Custom",
    },
    limits: { assets: inf, users: inf, places: inf, docs: inf },
    benefits: [
      "Your logo, colours & domain",
      "Branded login & customer portal",
      "Branded emails & vouchers",
      "Bulk customer invitations",
      "Programme analytics",
      "Dedicated onboarding",
    ],
    agents: ["All agents"],
    support: "Enterprise SLA",
  },
];

export const planByKey = (k?: string | null): PlanDef =>
  plans.find((p) => p.key === k) ?? plans[0]!;
export const plansFor = (a: Audience) =>
  a === "individual"
    ? plans.filter((p) => p.audience === "individual")
    : plans.filter((p) => p.audience !== "individual");
export const gbp = (n: number) => `£${n % 1 ? n.toFixed(2) : n.toLocaleString("en-GB")}`;
export const priceLabel = (p: PlanDef, yearly: boolean) =>
  (yearly ? p.yearly : p.monthly) === null ? "Contact us" : gbp((yearly ? p.yearly : p.monthly)!);
export const yearlySaving = (p: PlanDef) =>
  p.monthly && p.yearly ? Math.round((p.monthly * 12 - p.yearly) * 100) / 100 : 0;
export const nextPlan = (k: string) => {
  const p = planByKey(k);
  const list = plans.filter((x) => x.audience === p.audience);
  return list[list.indexOf(p) + 1];
};
export function trialInfo(trialEndsAt?: string | null, source?: string | null) {
  if (source !== "trial" || !trialEndsAt) return null;
  const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 864e5);
  return { days: Math.max(0, days), expired: days <= 0, ends: new Date(trialEndsAt) };
}
