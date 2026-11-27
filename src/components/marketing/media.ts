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
  if (/dental|health/.test(slug)) return photos.dental;
  if (/retail/.test(slug)) return photos.retail;
  if (/hospital|restaurant/.test(slug)) return photos.cafe;
  if (/construction/.test(slug)) return photos.construction;
  if (/warehouse|logistics/.test(slug)) return photos.warehouse;
  if (/manufactur/.test(slug)) return photos.manufacturing;
  if (/education/.test(slug)) return photos.education;
  if (/vehicle|fleet/.test(slug)) return photos.vehicle;
  if (/equipment|maintenance|warranty/.test(slug)) return photos.appliance;
  if (/office|business|compliance|renewal/.test(slug)) return photos.it;
  return photos.family;
}
