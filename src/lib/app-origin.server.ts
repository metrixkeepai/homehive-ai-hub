type OriginEnvironment = Record<string, string | undefined>;

function parseOrigin(value: string, env: OriginEnvironment): string {
  if (value !== value.trim() || /[\\\s]/.test(value))
    throw new Error("Invalid app origin configuration");
  const url = new URL(value);
  const local =
    (env["NODE_ENV"] === "development" || env["NODE_ENV"] === "test") &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.hostname.includes("*") ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid app origin configuration");
  }
  return url.origin;
}

/** Server configuration is authoritative; never infer this from Host or forwarded headers. */
export function getAppOrigin(env: OriginEnvironment = process.env): string {
  const configured = env["APP_ORIGIN"];
  if (!configured) throw new Error("APP_ORIGIN is not configured");
  return parseOrigin(configured, env);
}

/** Exact origins only. Each staging deployment has its own explicit configuration. */
export function trustedReturnUrl(
  value: unknown,
  fallbackPath: string,
  env: OriginEnvironment = process.env,
): string {
  const canonical = getAppOrigin(env);
  const allowed = new Set([canonical]);
  if (env["APP_ENV"] === "staging" && env["CONNECTOR_PREVIEW_ORIGIN"])
    allowed.add(parseOrigin(env["CONNECTOR_PREVIEW_ORIGIN"], env));
  const additional = env["APP_ADDITIONAL_RETURN_ORIGINS"];
  if (additional)
    for (const entry of additional.split(",")) allowed.add(parseOrigin(entry.trim(), env));
  if (value === undefined) return new URL(fallbackPath, canonical).href;
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    value !== value.trim() ||
    value.includes("\\") ||
    [...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  ) {
    throw new Error("Invalid return URL");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid return URL");
  }
  if (url.username || url.password || !allowed.has(url.origin))
    throw new Error("Return URL origin is not allowed");
  return url.href;
}

export function googleOAuthReturnUrl(env: OriginEnvironment = process.env): string {
  return new URL("/api/oauth/google/return", getAppOrigin(env)).href;
}
