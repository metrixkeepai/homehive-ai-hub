export type PassportEntity = "property" | "asset" | "vehicle" | "business" | "evidence" | "other";

export const ENTITY_BY_SECTION: Record<string, PassportEntity> = { "my-home": "property", assets: "asset", vehicles: "vehicle", locations: "business" };

export const OG_TITLE: Record<PassportEntity, string> = {
  property: "MatrixKeep Property Digital Passport",
  asset: "MatrixKeep Asset Digital Passport",
  vehicle: "MatrixKeep Vehicle Digital Passport",
  business: "MatrixKeep Business Digital Passport",
  evidence: "MatrixKeep Evidence Pack",
  other: "MatrixKeep Digital Passport",
};
export const OG_IMAGE: Record<PassportEntity, string> = {
  property: "passport-property", asset: "passport-asset", vehicle: "passport-vehicle",
  business: "passport-business", evidence: "passport-property", other: "passport-property",
};
export const OG_DESCRIPTION = "A secure Digital Passport has been shared with you through MatrixKeep. View the information the owner has chosen to share — no account required.";

export const SITE = "https://matrixkeep.com";
/** Production links always use the branded domain; local dev keeps localhost. */
export function shareBase(origin: string) {
  return /localhost|127\.0\.0\.1/.test(origin) ? origin : SITE;
}
export function shareUrl(origin: string, token: string, entity: PassportEntity) {
  return `${shareBase(origin)}/p/${token}?k=${entity}`;
}
export function isEntity(v: unknown): v is PassportEntity {
  return typeof v === "string" && v in OG_TITLE;
}

type Input = { entity: PassportEntity; name?: string; expiresAt?: Date | null };

export function formatExpiry(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Body text (without URL) — the secure URL is appended separately so it can't be edited. */
export function buildPassportShareMessage({ entity, name, expiresAt }: Input): string {
  const exp = expiresAt ? `⏳ Available until ${formatExpiry(expiresAt)}` : "";
  const tag = "*MatrixKeep — Keep What Matters. Know What's Next.*";
  const lines = (...l: string[]) => l.filter((x) => x !== "").join("\n");
  switch (entity) {
    case "property":
      return name
        ? lines("🏡 *A Property Digital Passport has been shared with you*", "", "I've securely shared selected information for:", `*${name}*`, "", "View the property's organised digital record, including the information I've chosen to share with you.", "", "🔐 Secure MatrixKeep link", "👤 No account required", exp, "", "View Passport:")
        : lines("🏡 *I've shared a MatrixKeep Digital Passport with you*", "", "Everything important about this property is organised in one secure place — key details, assets, documents, warranties, maintenance and important history, based on what I've chosen to share.", "", "🔐 Secure guest access", "👤 No MatrixKeep account required", exp || "⏳ Access may be time-limited", "", "View the Digital Passport:");
    case "asset":
      return lines("📦 *I've shared a MatrixKeep Asset Passport with you*", "", ...(name ? ["I've securely shared the digital record for:", `*${name}*`, ""] : []), "It brings the item's key information, documents, warranty, maintenance and evidence together in one place — based on what I've chosen to share.", "", "🔐 Secure guest access", "👤 No account required", exp, "", "View Asset Passport:");
    case "vehicle":
      return lines("🚗 *I've shared a MatrixKeep Vehicle Passport with you*", "", ...(name ? [`*${name}*`, ""] : []), "A secure digital record containing the vehicle information I've chosen to share — such as documents, MOT, service history, insurance and maintenance.", "", "🔐 Secure access", "👤 No MatrixKeep account required", exp || "⏳ Access may expire", "", "View Vehicle Passport:");
    case "business":
      return lines("🏢 *A MatrixKeep Business Digital Passport has been shared with you*", "", ...(name ? ["You've been given secure access to selected information for:", `*${name}*`, ""] : []), "View the authorised asset, equipment, maintenance, document, certificate and operational records in one organised place.", "", "🔐 Controlled guest access", "👤 No MatrixKeep account required", exp || "⏳ Access may be time-limited", "", "Open Digital Passport:");
    case "evidence":
      return lines("📋 *A MatrixKeep Evidence Pack has been shared with you*", "", "The relevant records and supporting evidence have been organised into one secure digital view.", "", "No account is required to view the information that has been shared with you.", exp, "", "Open Secure Pack:");
    default:
      return lines("🔐 *A MatrixKeep Digital Passport has been shared with you*", "", "Important records. One secure view — based on what I've chosen to share.", "", "👤 No account required", exp, "", "View the Digital Passport:");
  }
}

export function composeShare(body: string, url: string, entity: PassportEntity) {
  const footer = entity === "business"
    ? "*MatrixKeep*\nThe intelligent Digital Passport for everything worth keeping track of."
    : "*MatrixKeep — Keep What Matters. Know What's Next.*\nThe AI-powered Digital Passport for your home, assets and everything worth remembering.";
  return `${body.trim()}\n${url}\n\n${footer}`;
}

/** Plain-text email (mail apps don't accept HTML through a mailto link). */
export function buildEmail({ entity, name, expiresAt }: Input, url: string) {
  const subject = "A MatrixKeep Digital Passport has been shared with you";
  const what = OG_TITLE[entity].replace("MatrixKeep ", "");
  const body = [
    "MATRIXKEEP", "", `A ${what.toUpperCase()} HAS BEEN SHARED WITH YOU`, "",
    "I've securely shared selected information with you through MatrixKeep.",
    ...(name ? ["", name] : []), "",
    "Everything relevant is organised into one controlled digital view.", "",
    "View Digital Passport:", url, "",
    "✓ No account required", "✓ Secure guest access",
    ...(expiresAt ? [`✓ Link expires: ${formatExpiry(expiresAt)}`] : []), "",
    "—", "MatrixKeep", "Keep What Matters. Know What's Next.",
    "The AI-powered Digital Passport for homes, assets and businesses.",
    `Discover MatrixKeep: ${SITE}`,
  ].join("\n");
  return { subject, body };
}
