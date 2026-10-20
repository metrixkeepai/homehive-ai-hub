// Plan feature catalogue + entitlement rules. Benefits text in plans.ts stays marketing copy;
// entitlements here decide actual product access. Published (approved) plan versions override the defaults.
import { planByKey, plans, type Audience } from "@/lib/plans";

export type Unit = "count" | "MB" | "GB" | "TB" | "per month";
export type FeatureDef = {
  key: string;
  name: string;
  desc: string;
  group: string;
  audience: "individual" | "business";
  unit?: Unit | undefined;
  min: number;
  limits?: (number | null)[] | undefined;
};
export type Entitlement = {
  on: boolean;
  limit?: number | null | undefined;
  unit?: Unit | undefined;
}; // limit null = unlimited
export type Entitlements = Record<string, Entitlement>;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
// [name, minimum tier index within the audience (0 = lowest plan), optional per-tier limits (null = unlimited), unit]
type Row = [string, number, (number | null)[]?, Unit?];
const U = null;
const ind: Record<string, Row[]> = {
  Capacity: [
    ["Users", 0, [1, 2, 5, 10]],
    ["Properties", 0, [1, 1, 2, 5]],
    ["Rooms", 0, [3, U, U, U]],
    ["Assets", 0, [50, 500, 2500, 10000]],
    ["Documents", 0, [10, 500, 2500, 10000]],
    ["Vehicles", 2, [0, 0, 3, 10]],
    ["Storage", 0, [500, 10240, 51200, 204800], "MB"],
    ["AI Captures", 0, [5, 100, 500, 1500], "per month"],
    ["Sera Questions", 0, [10, 300, 1500, 5000], "per month"],
    ["Sera Voice Minutes", 1, [0, 30, 120, 300], "per month"],
    ["Room/Video Scans", 1, [0, 10, 50, 150], "per month"],
    ["Secure Shares", 1, [0, 10, 50, U], "per month"],
  ],
  Capture: [
    ["Basic Photo Capture", 0],
    ["AI Photo Recognition", 1],
    ["Receipt Scan", 0],
    ["AI Receipt Extraction", 1],
    ["Room Scan", 1],
    ["Advanced Video Room Scan", 2],
    ["Barcode / QR Scan", 0],
    ["Voice Capture", 0],
    ["Email Import", 1],
    ["Email Import & Matching", 2],
  ],
  "Assets & Passports": [
    ["Manual Asset Entry", 0],
    ["Asset Passport", 1],
    ["Property Passport", 1],
    ["Vehicle Passport", 2],
    ["Vehicle MOT Tracking", 2],
    ["Replacement Value Estimates", 2],
  ],
  "Documents & Evidence": [
    ["Receipt Storage", 0],
    ["Document Vault", 0],
    ["Evidence Gallery", 0],
    ["PDF Viewer", 0],
    ["Receipt Viewer", 0],
    ["Secure Sharing", 1],
    ["Advanced Secure Sharing", 3],
  ],
  Warranties: [
    ["Warranty Records", 0],
    ["Warranty Duration Extraction", 1],
    ["Automatic Warranty Expiry", 1],
    ["Warranty Reminders", 0],
    ["Warranty Claim Readiness", 2],
  ],
  Maintenance: [
    ["Maintenance Records", 0],
    ["Maintenance Reminders", 1],
    ["Recurring Maintenance", 1],
    ["Maintenance History", 0],
  ],
  Insurance: [
    ["Insurance Evidence Inventory", 2],
    ["Claim Pack Generator", 2],
  ],
  Property: [
    ["Moving Mode", 2],
    ["Sell My Home Mode", 2],
    ["Seller Passport", 2],
  ],
  Family: [
    ["Household Members", 1],
    ["Family Roles", 3],
    ["Private Member Vaults", 3],
    ["Room-Level Permissions", 3],
    ["Asset-Level Permissions", 3],
    ["Temporary Access", 3],
  ],
  "AI & Sera": [
    ["Sera Text Assistant", 0],
    ["Sera Voice", 1],
    ["Basic AI Agents", 1],
    ["Advanced AI Agents", 2],
  ],
  Integrations: [
    ["Gmail", 1],
    ["Google Calendar", 2],
    ["Google Drive", 1],
  ],
  Support: [
    ["Help Centre", 0],
    ["Standard Support", 1],
    ["Priority Support", 2],
  ],
};
const biz: Record<string, Row[]> = {
  Capacity: [
    ["Users", 0, [3, 10, 30, 100]],
    ["Locations", 0, [2, 5, 25, 100]],
    ["Departments", 1, [0, 5, 25, U]],
    ["Assets", 0, [250, 1500, 10000, 50000]],
    ["Equipment", 0, [250, 1500, 10000, 50000]],
    ["Documents", 0, [500, 5000, 25000, 100000]],
    ["Vehicles", 0, [1, 10, 50, 250]],
    ["Storage", 0, [5, 25, 100, 500], "GB"],
    ["AI Captures", 0, [100, 500, 2000, 10000], "per month"],
    ["Sera Questions", 0, [500, 2000, 10000, 50000], "per month"],
    ["Sera Voice Minutes", 1, [0, 120, 600, 3000], "per month"],
    ["Room/Video Scans", 1, [0, 50, 250, 1000], "per month"],
    ["Secure Shares", 0, [20, 100, U, U], "per month"],
    ["API Requests", 2, [0, 0, 10000, 100000], "per month"],
  ],
  Organisation: [
    ["Team Members", 0],
    ["Asset Assignment", 1],
    ["Business Units", 3],
    ["Custom Roles", 2],
    ["Delegated Location Administration", 3],
  ],
  "Assets & Equipment": [
    ["Asset Register", 0],
    ["Equipment Register", 0],
    ["Vehicle Fleet", 1],
    ["Equipment Digital Passports", 1],
  ],
  "Documents & Evidence": [
    ["Document Vault", 0],
    ["Evidence Management", 0],
    ["Bulk Document Import", 2],
    ["Bulk Evidence Actions", 2],
  ],
  Renewals: [
    ["Renewal Tracking", 0],
    ["Renewal Radar", 1],
    ["Advanced Renewal Automation", 2],
    ["Renewal Notifications", 0],
  ],
  Contracts: [
    ["Contract Management", 1],
    ["Contract Intelligence", 2],
    ["Notice Period Detection", 2],
    ["Contract Renewal Monitoring", 1],
  ],
  "Certificates & Compliance": [
    ["Certificate Tracking", 0],
    ["Certificate Expiry Monitoring", 0],
    ["Compliance Evidence Tracking", 2],
  ],
  Maintenance: [
    ["Maintenance Calendar", 1],
    ["Recurring Maintenance", 1],
    ["Advanced Maintenance Planning", 2],
  ],
  Suppliers: [["Supplier Records", 2]],
  "Permissions & Governance": [
    ["Department Hierarchy & Custom Roles", 2],
    ["Advanced Permission Matrix", 2],
    ["Approval Workflows", 1],
    ["Advanced Approval Chains", 3],
    ["Full Audit Logs", 2],
  ],
  Reporting: [
    ["Basic Reports", 0],
    ["Advanced Reports", 2],
    ["Scheduled Reports", 2],
    ["Custom Reports", 3],
    ["Location Benchmarking", 2],
    ["Cost Analytics", 2],
    ["Asset Value Analytics", 2],
    ["Warranty Analytics", 1],
    ["Renewal Analytics", 1],
  ],
  Automation: [
    ["Advanced Automation", 3],
    ["Agent Performance Dashboard", 2],
  ],
  Integrations: [
    ["Email Integration", 1],
    ["Calendar Integration", 1],
    ["API Access", 2],
    ["Webhooks", 3],
    ["SSO", 4],
  ],
  Operations: [
    ["Bulk Imports", 2],
    ["Bulk Actions", 2],
    ["Bulk User Provisioning", 3],
    ["Advanced Retention Controls", 4],
  ],
  Support: [
    ["Standard Support", 0],
    ["Priority Support", 2],
    ["Dedicated Onboarding", 4],
  ],
};
const build = (src: Record<string, Row[]>, audience: FeatureDef["audience"]): FeatureDef[] =>
  Object.entries(src).flatMap(([group, rows]) =>
    rows.map(([name, min, limits, unit]) => ({
      key: slug(name),
      name,
      group,
      audience,
      min,
      limits,
      unit: limits ? (unit ?? "count") : undefined,
      desc: limits
        ? `Maximum ${name.toLowerCase()} this plan allows.`
        : `Unlocks ${name.toLowerCase()}.`,
    })),
  );
export const catalogue = { individual: build(ind, "individual"), business: build(biz, "business") };
export const catalogueFor = (a: Audience) =>
  a === "individual" ? catalogue.individual : catalogue.business;
export const groupsFor = (a: Audience) => [...new Set(catalogueFor(a).map((f) => f.group))];

/** Defaults for a plan from its tier within its audience (enterprise plans get everything, unlimited). */
export function defaultEntitlements(planKey: string, audience?: Audience): Entitlements {
  const p = plans.find((x) => x.key === planKey);
  const aud = p?.audience ?? "individual";
  const list = plans.filter((x) => x.audience === aud);
  const tier =
    aud === "enterprise"
      ? 99
      : Math.max(
          0,
          list.findIndex((x) => x.key === planKey),
        );
  const out: Entitlements = {};
  for (const f of catalogueFor(aud)) {
    const lim = f.limits
      ? aud === "enterprise"
        ? null
        : (f.limits[Math.min(tier, f.limits.length - 1)] ?? null)
      : undefined;
    out[f.key] = {
      on: !!p && (!audience || audience === aud) && tier >= f.min && lim !== 0,
      ...(f.limits ? { limit: lim === 0 ? 0 : lim, unit: f.unit } : {}),
    };
  }
  return out;
}

/** Effective entitlements: published overrides on top of defaults. */
export const effective = (planKey: string, published?: Entitlements | null): Entitlements => ({
  ...defaultEntitlements(planKey),
  ...(published ?? {}),
});

/** Which entitlement guards adding to a section. */
export const sectionGate: Record<string, { feature: string; limit?: string; label: string }> = {
  rooms: { feature: "rooms", limit: "rooms", label: "rooms" },
  vehicles: { feature: "vehicles", limit: "vehicles", label: "vehicles" },
  "my-home": { feature: "properties", limit: "properties", label: "properties" },
  properties: { feature: "properties", limit: "properties", label: "properties" },
  assets: { feature: "assets", limit: "assets", label: "assets" },
  documents: { feature: "documents", limit: "documents", label: "documents" },
  locations: { feature: "locations", limit: "locations", label: "locations" },
  team: { feature: "team_members", limit: "users", label: "team members" },
  insurance: { feature: "insurance_evidence_inventory", label: "insurance records" },
  family: { feature: "household_members", limit: "users", label: "household members" },
};

export type GateResult =
  | { ok: true }
  | { ok: false; reason: "locked" | "limit"; feature: string; max?: number; label: string };
export function checkAdd(ent: Entitlements, slug: string, count: number): GateResult {
  const g = sectionGate[slug];
  if (!g) return { ok: true };
  const f = ent[g.feature];
  if (!f?.on) return { ok: false, reason: "locked", feature: g.feature, label: g.label };
  const l = g.limit ? ent[g.limit] : undefined;
  if (l && !l.on) return { ok: false, reason: "locked", feature: g.feature, label: g.label };
  if (l && typeof l.limit === "number" && count >= l.limit)
    return { ok: false, reason: "limit", feature: g.limit!, max: l.limit, label: g.label };
  return { ok: true };
}

/** Plans in the same audience that would allow this feature (and a higher limit when relevant). */
export function eligiblePlans(
  currentKey: string,
  feature: string,
  published: Record<string, Entitlements>,
  needMoreThan?: number | undefined,
) {
  const aud = planByKey(currentKey).audience;
  return plans
    .filter((p) => p.audience === aud && p.key !== currentKey)
    .filter((p) => {
      const e = effective(p.key, published[p.key])[feature];
      if (!e?.on) return false;
      return (
        needMoreThan === undefined ||
        e.limit === null ||
        e.limit === undefined ||
        e.limit > needMoreThan
      );
    })
    .map((p) => p.key);
}

/** Feature-specific upgrade copy. */
export const upgradeCopy: Record<string, [string, string]> = {
  vehicle_passport: [
    "Give Your Vehicle Its Own Digital Passport",
    "Track MOT, service, insurance, tax and every receipt for each vehicle in one place.",
  ],
  vehicles: [
    "Give Your Vehicle Its Own Digital Passport",
    "Track MOT, service, insurance, tax and every receipt for each vehicle in one place.",
  ],
  room_scan: [
    "Scan Your Whole Room with AI",
    "Point your camera and let MatrixKeep recognise everything in the room.",
  ],
  advanced_video_room_scan: [
    "Let MatrixKeep See the Whole Room",
    "Record a short video and MatrixKeep catalogues every item it sees.",
  ],
  claim_pack_generator: [
    "Turn Your Evidence Into a Claim-Ready Pack",
    "Bundle receipts, photos and values into one pack for your insurer.",
  ],
  insurance_evidence_inventory: [
    "Turn Your Evidence Into a Claim-Ready Pack",
    "Keep an insurer-ready inventory of everything you own.",
  ],
  email_import: [
    "Let MatrixKeep Find the Records for You",
    "Import receipts, warranties and renewals straight from your inbox.",
  ],
  gmail: [
    "Let MatrixKeep Find the Records for You",
    "Import receipts, warranties and renewals straight from your inbox.",
  ],
  team_members: [
    "Give Every Team Member the Right Access",
    "Invite your team and control what each person can see and do.",
  ],
  users: [
    "Give Every Team Member the Right Access",
    "Invite more people and control what each person can see and do.",
  ],
  renewal_tracking: [
    "Stop Chasing Renewal Dates",
    "MatrixKeep watches every contract, licence and certificate for you.",
  ],
  api_access: [
    "Connect MatrixKeep to Your Business Systems",
    "Use the API and webhooks to sync MatrixKeep with your tools.",
  ],
};
export const copyFor = (feature: string, label: string): [string, string] =>
  upgradeCopy[feature] ?? [`Unlock more ${label}`, `Upgrade your plan to add more ${label}.`];

/** Human label for a limit: "Unlimited", "500 MB", "100 / month". */
export function formatLimit(e?: Entitlement): string {
  if (!e || !e.on) return "—";
  if (e.limit === undefined) return "Included";
  if (e.limit === null) return "Unlimited";
  const n = e.limit.toLocaleString("en-GB");
  return e.unit === "per month"
    ? `${n} / month`
    : e.unit && e.unit !== "count"
      ? `${n} ${e.unit}`
      : n;
}
