import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  requests: new Map<string, Record<string, string>>(),
  saved: "",
  deleted: false,
}));
vi.mock("./connector-review.server", () => ({
  db: {
    from: () => ({
      insert: async (row: Record<string, string>) => {
        f.requests.set(row["state_hash"]!, row);
        return { error: null };
      },
      delete: () => {
        const filters: Record<string, string> = {};
        const q = {
          eq: (k: string, v: string) => {
            filters[k] = v;
            return q;
          },
          gt: () => q,
          select: () => q,
          single: async () => {
            const row = f.requests.get(filters["state_hash"]!);
            if (!row || Object.entries(filters).some(([k, v]) => row[k] !== v))
              return { error: true };
            f.requests.delete(filters["state_hash"]!);
            return { data: row };
          },
        };
        return q;
      },
    }),
  },
}));
vi.mock("@/server/appUserConnections.server", () => ({
  saveConnectionKeyForUser: async (_u: string, _p: string, k: string) => {
    f.saved = k;
  },
  getConnectionKeyForUser: async () => f.saved,
  markConnection: async () => {},
  deleteConnectionForUser: async () => {
    f.deleted = true;
  },
}));
import { beginConsent, finishGoogle, disconnect } from "./google-consent.server";
beforeEach(() => {
  f.requests.clear();
  f.saved = "";
  f.deleted = false;
  vi.stubEnv("APP_ORIGIN", "https://staging.example");
  vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_ID", "fixture");
  vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv("APP_USER_CONNECTION_KEY_SECRET", Buffer.alloc(32, 1).toString("base64"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each([
  ["google_mail", "gmail.readonly"],
  ["google_drive", "drive.readonly"],
  ["google_calendar", "calendar.events"],
] as const)(
  "uses a user-bound one-time code and verifies the requested %s scope",
  async (p, suffix) => {
    const start = await beginConsent("alice", p, undefined);
    const url = new URL(start.authorizationUrl);
    const scope = url.searchParams.get("scope")!;
    expect(scope).toContain("/auth/" + suffix);
    expect(url.searchParams.has("client_secret")).toBe(false);
    const post = vi.fn(async (u: string, init: RequestInit) => {
      if (u.endsWith("revoke")) return new Response("");
      const b = init.body as URLSearchParams;
      expect(b.get("code_verifier")?.length).toBeGreaterThan(42);
      return Response.json({
        access_token: "qa-access",
        refresh_token: "qa-refresh",
        scope,
        expires_in: 3600,
      });
    });
    vi.stubGlobal("fetch", post);
    await expect(finishGoogle("bob", p, start.state, "fake-code")).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    await finishGoogle("alice", p, start.state, "fake-code");
    expect(JSON.parse(f.saved).refresh_token).toBe("qa-refresh");
    await expect(finishGoogle("alice", p, start.state, "fake-code")).rejects.toThrow();
    expect(await disconnect("alice", p)).toEqual({ revoked: true });
    expect(f.deleted).toBe(true);
  },
);
