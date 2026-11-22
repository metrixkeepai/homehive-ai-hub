// Provider contract tests use synthetic responses and per-test grants.
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const fx = vi.hoisted(() => ({
  saved: new Map<string, Record<string, string>>(),
  stored: new Map<string, string>(),
  user: "qa",
  reconnect: false,
  queued: new Set<string>(),
  cursor: null as null | Record<string, unknown>,
}));
vi.mock("./connector-review.server", () => ({
  requireConnectorPlan: async () => {},
  eligible: (f: { mime: string; size: number }) => f.mime === "application/pdf" && f.size === 12,
  scoped: (table: string) => ({
    eq: (_k: string, v: string) => ({
      maybeSingle: async () => ({
        data:
          table === "connector_scan_state"
            ? fx.cursor
            : fx.queued.has(v)
              ? { id: "fixture" }
              : null,
      }),
    }),
  }),
  queue: async (
    _s: unknown,
    k: string,
    _title: string,
    _source: unknown,
    _text: string,
    _file: unknown,
    bytes: Buffer,
  ) => {
    expect(bytes.toString()).toBe("%PDF-fixture");
    fx.queued.add(k);
    return 1;
  },
  db: {
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        fx.cursor = row;
        return { error: null };
      },
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
import { start, finish, browse, scanOutlook, importMsFile } from "./ms-connector.server";
beforeEach(() => {
  fx.saved.clear();
  fx.queued.clear();
  fx.cursor = null;
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

it("reads the Outlook invoice attachment, excludes newsletters and skips a duplicate", async () => {
  const scope = { provider: "outlook", user: "alice", ws: null };
  fx.stored.set(
    "aliceoutlook",
    JSON.stringify({ access_token: "fixture", expires_at: Date.now() + 3600000 }),
  );
  const graph = vi.fn(async (u: URL) => {
    if (u.pathname.endsWith("/inbox")) return Response.json({ id: "inbox" });
    if (u.pathname.endsWith("/inbox/messages"))
      return Response.json({
        value: [
          {
            id: "a",
            subject: "Invoice",
            hasAttachments: true,
            receivedDateTime: "2026-11-20T00:00:00Z",
          },
          { id: "b", subject: "Newsletter" },
        ],
      });
    if (u.pathname.endsWith("/a/attachments"))
      return Response.json({
        value: [{ id: "pdf", name: "invoice.pdf", size: 12, contentType: "application/pdf" }],
      });
    if (u.pathname.endsWith("/pdf/$value")) return new Response("%PDF-fixture");
    throw Error("Unexpected Graph request");
  });
  vi.stubGlobal("fetch", graph);
  expect(await scanOutlook(scope)).toMatchObject({ created: 1, checked: 2, candidates: 1 });
  expect(await scanOutlook(scope)).toMatchObject({ created: 0, alreadyImported: 1 });
  expect(graph.mock.calls.filter(([u]) => u.pathname.endsWith("/$value"))).toHaveLength(1);
});
it("browses OneDrive, queues its file once and preserves the file version", async () => {
  const scope = { provider: "onedrive", user: "alice", ws: null };
  fx.stored.set(
    "aliceonedrive",
    JSON.stringify({ access_token: "fixture", expires_at: Date.now() + 3600000 }),
  );
  const f = {
    id: "a",
    name: "Invoice.pdf",
    file: { mimeType: "application/pdf" },
    size: 12,
    eTag: "v1",
    parentReference: { driveId: "drive" },
  };
  const graph = vi.fn(async (u: URL) =>
    u.pathname.endsWith("/content")
      ? new Response("%PDF-fixture")
      : Response.json(u.pathname.endsWith("/children") ? { value: [f] } : f),
  );
  vi.stubGlobal("fetch", graph);
  expect(await browse("alice", "")).toEqual([{ id: "a", name: "Invoice.pdf" }]);
  expect(await importMsFile(scope, "a")).toBe(1);
  expect(await importMsFile(scope, "a")).toBe(0);
  expect(graph.mock.calls.filter(([u]) => u.pathname.endsWith("/content"))).toHaveLength(1);
});
