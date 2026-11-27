const marketingImage = (path: string) => `/images/marketing/${path}`;

/** Original approved marketing binaries, served directly from public/. */
export const photos = {
  world: marketingImage("product/matrixkeep-world.png"),
  family: marketingImage("individuals/matrixkeep-family.webp"),
  cafe: marketingImage("business/matrixkeep-cafe.webp"),
  enterprise: marketingImage("enterprise/matrixkeep-enterprise.webp"),
  dental: marketingImage("industries/matrixkeep-dental.webp"),
  retail: marketingImage("industries/matrixkeep-retail.webp"),
  construction: marketingImage("industries/matrixkeep-construction.webp"),
  manufacturing: marketingImage("industries/matrixkeep-manufacturing.webp"),
  warehouse: marketingImage("industries/matrixkeep-warehouse.webp"),
  education: marketingImage("industries/matrixkeep-education.webp"),
  appliance: marketingImage("product/matrixkeep-appliance.webp"),
  vehicle: marketingImage("product/matrixkeep-vehicle.webp"),
  coffee: marketingImage("product/matrixkeep-coffee.webp"),
  it: marketingImage("product/matrixkeep-it.webp"),
};

export const scenes: Record<string, string> = {
  healthcare: marketingImage("industries/scene-healthcare.webp"),
  retail: marketingImage("industries/scene-retail.webp"),
  education: marketingImage("industries/scene-education.webp"),
  property: marketingImage("industries/scene-property.webp"),
  construction: marketingImage("industries/scene-construction.webp"),
  hospitality: marketingImage("industries/scene-hospitality.webp"),
  offices: marketingImage("industries/scene-offices.webp"),
  manufacturing: marketingImage("industries/scene-manufacturing.webp"),
  dental: marketingImage("industries/scene-dental.webp"),
  "warehousing-logistics": marketingImage("industries/scene-warehousing-logistics.webp"),
  "automotive-fleet": marketingImage("industries/scene-automotive-fleet.webp"),
  "homeowners-families": marketingImage("industries/scene-homeowners-families.webp"),
  "home-inventory": marketingImage("use-cases/scene-home-inventory.webp"),
  "warranty-tracking": marketingImage("use-cases/scene-warranty-tracking.webp"),
  "renewal-tracking": marketingImage("use-cases/scene-renewal-tracking.webp"),
  "insurance-claims": marketingImage("use-cases/scene-insurance-claims.webp"),
  "passport-transfer": marketingImage("use-cases/scene-passport-transfer.webp"),
  "multi-location": marketingImage("use-cases/scene-multi-location.webp"),
  "vehicles-fleet": marketingImage("use-cases/scene-vehicles-fleet.webp"),
  "equipment-logistics": marketingImage("use-cases/scene-equipment-logistics.webp"),
  "business-asset-management": marketingImage("use-cases/scene-business-asset-management.webp"),
  "compliance-evidence": marketingImage("use-cases/scene-compliance-evidence.webp"),
  "property-asset-intelligence": marketingImage("use-cases/scene-property-asset-intelligence.webp"),
  "important-documents": marketingImage("use-cases/scene-important-documents.webp"),
  features: marketingImage("product/scene-features.webp"),
  "ai-agents": marketingImage("product/scene-ai-agents.webp"),
  sera: marketingImage("sera/scene-sera.webp"),
  "digital-passport": marketingImage("digital-passport/scene-digital-passport.webp"),
  partners: marketingImage("product/scene-partners.webp"),
  "how-it-works": marketingImage("product/scene-how-it-works.webp"),
  about: marketingImage("product/scene-about.webp"),
  security: marketingImage("product/scene-security.webp"),
  intelligence: marketingImage("hero/scene-intelligence.webp"),
  life: marketingImage("hero/scene-life.webp"),
  business: marketingImage("hero/scene-business.webp"),
};

export function storyPhoto(slug: string) {
  return scenes[slug] ?? photos.world;
}

export function publicHero(path: string) {
  if (path === "/business") return photos.cafe;
  if (path === "/industries") return photos.warehouse;
  if (path === "/use-cases") return photos.world;
  const slug = path.split("/").filter(Boolean).at(-1) ?? "life";
  return (
    scenes[slug] ??
    (slug === "individual" ? photos.family : slug === "enterprise" ? photos.enterprise : photos.it)
  );
}
