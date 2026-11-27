import world from "@/assets/marketing/world.asset.json";
import family from "@/assets/marketing/family.asset.json";
import cafe from "@/assets/marketing/cafe.asset.json";
import enterprise from "@/assets/marketing/enterprise.asset.json";
import dental from "@/assets/marketing/dental.asset.json";
import retail from "@/assets/marketing/retail.asset.json";
import construction from "@/assets/marketing/construction.asset.json";
import manufacturing from "@/assets/marketing/manufacturing.asset.json";
import warehouse from "@/assets/marketing/warehouse.asset.json";
import education from "@/assets/marketing/education.asset.json";
import appliance from "@/assets/marketing/appliance.asset.json";
import vehicle from "@/assets/marketing/vehicle.asset.json";
import coffee from "@/assets/marketing/coffee.asset.json";
import it from "@/assets/marketing/it.asset.json";
export const photos = {
  world: world.url,
  family: family.url,
  cafe: cafe.url,
  enterprise: enterprise.url,
  dental: dental.url,
  retail: retail.url,
  construction: construction.url,
  manufacturing: manufacturing.url,
  warehouse: warehouse.url,
  education: education.url,
  appliance: appliance.url,
  vehicle: vehicle.url,
  coffee: coffee.url,
  it: it.url,
};
export function storyPhoto(slug: string) {
  return scenes[slug] ?? photos.world;
}
export function publicHero(path: string) {
  if (path === "/business") return photos.cafe;
  if (path === "/industries") return photos.warehouse;
  if (path === "/use-cases") return photos.world;
  const slug = path.split("/").filter(Boolean).at(-1) ?? "life";
  return scenes[slug] ?? (slug === "individual" ? photos.family : slug === "enterprise" ? photos.enterprise : photos.it);
}

import scene0 from "@/assets/marketing/scene-healthcare.webp.asset.json";
import scene1 from "@/assets/marketing/scene-retail.webp.asset.json";
import scene2 from "@/assets/marketing/scene-education.webp.asset.json";
import scene3 from "@/assets/marketing/scene-property.webp.asset.json";
import scene4 from "@/assets/marketing/scene-construction.webp.asset.json";
import scene5 from "@/assets/marketing/scene-hospitality.webp.asset.json";
import scene6 from "@/assets/marketing/scene-offices.webp.asset.json";
import scene7 from "@/assets/marketing/scene-manufacturing.webp.asset.json";
import scene8 from "@/assets/marketing/scene-dental.webp.asset.json";
import scene9 from "@/assets/marketing/scene-warehousing-logistics.webp.asset.json";
import scene10 from "@/assets/marketing/scene-automotive-fleet.webp.asset.json";
import scene11 from "@/assets/marketing/scene-homeowners-families.webp.asset.json";
import scene12 from "@/assets/marketing/scene-home-inventory.webp.asset.json";
import scene13 from "@/assets/marketing/scene-warranty-tracking.webp.asset.json";
import scene14 from "@/assets/marketing/scene-renewal-tracking.webp.asset.json";
import scene15 from "@/assets/marketing/scene-insurance-claims.webp.asset.json";
import scene16 from "@/assets/marketing/scene-passport-transfer.webp.asset.json";
import scene17 from "@/assets/marketing/scene-multi-location.webp.asset.json";
import scene18 from "@/assets/marketing/scene-vehicles-fleet.webp.asset.json";
import scene19 from "@/assets/marketing/scene-equipment-logistics.webp.asset.json";
import scene20 from "@/assets/marketing/scene-business-asset-management.webp.asset.json";
import scene21 from "@/assets/marketing/scene-compliance-evidence.webp.asset.json";
import scene22 from "@/assets/marketing/scene-property-asset-intelligence.webp.asset.json";
import scene23 from "@/assets/marketing/scene-important-documents.webp.asset.json";
import scene24 from "@/assets/marketing/scene-features.webp.asset.json";
import scene25 from "@/assets/marketing/scene-ai-agents.webp.asset.json";
import scene26 from "@/assets/marketing/scene-sera.webp.asset.json";
import scene27 from "@/assets/marketing/scene-digital-passport.webp.asset.json";
import scene28 from "@/assets/marketing/scene-partners.webp.asset.json";
import scene29 from "@/assets/marketing/scene-how-it-works.webp.asset.json";
import scene30 from "@/assets/marketing/scene-about.webp.asset.json";
import scene31 from "@/assets/marketing/scene-security.webp.asset.json";
import scene32 from "@/assets/marketing/scene-intelligence.webp.asset.json";
import scene33 from "@/assets/marketing/scene-life.webp.asset.json";
import scene34 from "@/assets/marketing/scene-business.webp.asset.json";
export const scenes: Record<string, string> = {
  "healthcare": scene0.url,
  "retail": scene1.url,
  "education": scene2.url,
  "property": scene3.url,
  "construction": scene4.url,
  "hospitality": scene5.url,
  "offices": scene6.url,
  "manufacturing": scene7.url,
  "dental": scene8.url,
  "warehousing-logistics": scene9.url,
  "automotive-fleet": scene10.url,
  "homeowners-families": scene11.url,
  "home-inventory": scene12.url,
  "warranty-tracking": scene13.url,
  "renewal-tracking": scene14.url,
  "insurance-claims": scene15.url,
  "passport-transfer": scene16.url,
  "multi-location": scene17.url,
  "vehicles-fleet": scene18.url,
  "equipment-logistics": scene19.url,
  "business-asset-management": scene20.url,
  "compliance-evidence": scene21.url,
  "property-asset-intelligence": scene22.url,
  "important-documents": scene23.url,
  "features": scene24.url,
  "ai-agents": scene25.url,
  "sera": scene26.url,
  "digital-passport": scene27.url,
  "partners": scene28.url,
  "how-it-works": scene29.url,
  "about": scene30.url,
  "security": scene31.url,
  "intelligence": scene32.url,
  "life": scene33.url,
  "business": scene34.url,
};
