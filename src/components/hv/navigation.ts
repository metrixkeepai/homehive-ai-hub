import { sections, type Section } from "./data";

export type NavGroup = { label: string; items: { section: Section; label: string }[] };
export function accountNavigation(business: boolean): NavGroup[] {
  const groups: [string, string[]][] = [
    [business ? "Organisation & inventory" : "Home & belongings", ["my-home", ...(business ? ["locations"] : []), "rooms", "assets", "vehicles"]],
    ["Protection & paperwork", ["documents", "warranties", "renewals", "insurance"]],
    ["Care & activity", ["calendar", "maintenance", "tasks", "timeline", "services"]],
    [business ? "People & intelligence" : "Household & intelligence", [business ? "team" : "family", ...(business ? ["roles"] : []), "agents", "messages", "integrations"]],
    ["Account", sections.filter((s) => s.group === "account").map((s) => s.slug)],
  ];
  const businessLabels: Record<string, string> = { "my-home": "Organisation profile", rooms: "Rooms & spaces", assets: "Assets & equipment", vehicles: "Vehicles & fleet" };
  return groups.map(([label, slugs]) => ({ label, items: slugs.flatMap((slug) => {
    const section = sections.find((s) => s.slug === slug);
    return section ? [{ section, label: business ? businessLabels[slug] ?? section.title : section.title }] : [];
  }) }));
}