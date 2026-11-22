// Provider contract tests use synthetic responses and per-test grants.
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const fx = vi.hoisted(() => ({
  saved: new Map<string, Record<string, string>>(),
  stored: new Map<string, string>(),
  user: "qa",
  reconnect: false,
}));
vi.mock("./connector-review.server", () => ({
  requireConnectorPlan: async () => {},
  db: {
    from: () => ({
      insert: async (row: Record<string, string>) => {
        fx.saved.set(row["state_hash"]!, row);
        return { error: null };
      },
      delete: () => {
        const filters = new Map<string, string>();
        const q = {
          eq: (k: string, v: string) => {
            filters.set(k, v);
            return q;
          },
          lt: async () => ({}),
          gt: () => q,
          select: () => q,
          single: async () => {
            const row = fx.saved.get(filters.get("state_hash")!);
            if (!row || [...filters].some(([k, v]) => row[k] !== v)) return { error: true };
            fx.saved.delete(row["state_hash"]!);
            return { data: row };
          },
        };
        return q;
      },
    }),
  },
}));
vi.mock("@/server/appUserConnections.server", () => ({
  saveConnectionKeyForUser: async (user: string, provider: string, grant: string) => {
    fx.stored.set(user + provider, grant);
  },
  getConnectionKeyForUser: async (u: string, p: string) => fx.stored.get(u + p),
  markConnection: async () => {
    fx.reconnect = true;
  },
}));
import { start, finish, browse } from "./ms-connector.server";
beforeEach(() => {
  fx.saved.clear();
  fx.stored.clear();
  vi.stubEnv("APP_ORIGIN", "https://fixture.example");
  vi.stubEnv("MICROSOFT_CONNECTOR_CLIENT_ID", "fixture");
  vi.stubEnv("MICROSOFT_CONNECTOR_CLIENT_SECRET", "fixture");
  vi.stubEnv("APP_USER_CONNECTION_KEY_SECRET", Buffer.alloc(32, 17).toString("base64"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each([
  ["outlook", "Mail.Read"],
  ["onedrive", "Files.Read"],
] as const)(
  "binds %s consent to a user, scope, PKCE proof and one-time state",
  async (p, scope) => {
    const url = new URL(await start("alice", p, "https://fixture.example"));
    const state = url.searchParams.get("state")!;
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual(
      [scope, "offline_access"].sort(),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const fetch = vi.fn(async (_url: unknown, opts: RequestInit) => {
      const body = opts.body as URLSearchParams;
      expect(body.get("code_verifier")?.length).toBeGreaterThan(42);
      return Response.json({
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        expires_in: 3600,
      });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(finish("bob", p, state, "fixture-code")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await finish("alice", p, state, "fixture-code");
    expect(fx.stored.has("alice" + p)).toBe(true);
    await expect(finish("alice", p, state, "fixture-code")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it("rejects an unregistered callback origin before consent and never browses after a disconnect", async () => {
  await expect(start("alice", "onedrive", "https://unregistered.example")).rejects.toThrow();
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await expect(browse("alice", "invoice")).rejects.toThrow();
  expect(f).not.toHaveBeenCalled();
});
