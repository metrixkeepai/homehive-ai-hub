import { sections, type Section } from "./data";

/** Nav entries that are placeholders — hidden until a real product surface ships. */
export const STUB_NAV_SLUGS = new Set([
  "timeline",
  "services",
  "agents",
  "messages",
  "roles",
  "security",
  "privacy",
  "notifications",
  "settings",
  "help",
]);

export type NavGroup = { label: string; items: { section: Section; label: string }[] };
export function accountNavigation(business: boolean): NavGroup[] {
  const groups: [string, string[]][] = [
    [
      business ? "Organisation & inventory" : "Home & belongings",
      ["my-home", ...(business ? ["locations"] : []), "rooms", "assets", "vehicles"],
    ],
    ["Protection & paperwork", ["documents", "warranties", "renewals", "insurance"]],
    ["Care & activity", ["maintenance", "tasks"]],
    [
      business ? "People & intelligence" : "Household & intelligence",
      [business ? "team" : "family", "integrations"],
    ],
    [
      "Account",
      sections
        .filter((s) => s.group === "account" && !STUB_NAV_SLUGS.has(s.slug))
        .map((s) => s.slug),
    ],
  ];
  const businessLabels: Record<string, string> = {
    "my-home": "Organisation profile",
    rooms: "Rooms & spaces",
    assets: "Assets & equipment",
    vehicles: "Vehicles & fleet",
  };
  return groups
    .map(([label, slugs]) => ({
      label,
      items: slugs.flatMap((slug) => {
        if (STUB_NAV_SLUGS.has(slug)) return [];
        const section = sections.find((s) => s.slug === slug);
        return section
          ? [{ section, label: business ? (businessLabels[slug] ?? section.title) : section.title }]
          : [];
      }),
    }))
    .filter((g) => g.items.length > 0);
}
