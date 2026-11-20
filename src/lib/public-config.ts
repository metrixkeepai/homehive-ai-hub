type PublicSetting =
  | "VITE_APP_ORIGIN"
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_PUBLISHABLE_KEY"
  | "VITE_PAYMENTS_CLIENT_TOKEN";

declare global {
  interface Window {
    __MATRIXKEEP_PUBLIC__?: Partial<Record<PublicSetting, string>>;
  }
}

// The Node host serves these four settings before application modules execute.
// Vite's build-time values remain a fallback for local development and previews.
export function publicSetting(key: PublicSetting): string | undefined {
  if (typeof window !== "undefined" && window.__MATRIXKEEP_PUBLIC__)
    return window.__MATRIXKEEP_PUBLIC__[key];
  if (import.meta.env.SSR) {
    const value = process.env[key] || process.env[key.slice(5)];
    if (value) return value;
  }
  const development = {
    VITE_APP_ORIGIN: import.meta.env["VITE_APP_ORIGIN"],
    VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    VITE_PAYMENTS_CLIENT_TOKEN: import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"],
  };
  return development[key];
}
