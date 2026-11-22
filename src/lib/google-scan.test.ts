import { beforeEach, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({
  requests: [] as string[],
  queued: new Map<string, { name: string; bytes: string }>(),
  watermark: 0,
  disconnected: false,
}));
vi.mock("./feature-access.server", () => ({ requireFeature: async () => {} }));
vi.mock("@/server/appUserConnections.server", () => ({
  getConnectionKeyForUser: async () => (fx.disconnected ? null : "synthetic-grant"),
  markConnection: async () => {},
  getLinks: async () => new Map(),
}));
vi.mock("./connector-review.server", () => ({
  requireConnectorPlan: async () => {},
  eligible: (f: { size: number; mime: string }) => f.size > 0 && f.mime === "application/pdf",
  scoped: (table: string) => ({
    eq: (_k: string, v: string) => ({
      maybeSingle: async () => ({
        data: table === "connector_scan_state" ? { watermark: fx.watermark } : fx.queued.get(v),
      }),
    }),
  }),
  db: {
    from: () => ({
      upsert: async (v: { watermark: number }) => {
        fx.watermark = v.watermark;
        return { error: null };
      },
    }),
  },
  queue: async (
    _scope: unknown,
    key: string,
    _title: string,
    _source: unknown,
    _text: string,
    file: { name: string },
    bytes: Buffer,
  ) => {
    fx.queued.set(key, { name: file.name, bytes: bytes.toString() });
    return 1;
  },
}));
vi.mock("@/integrations/lovable/appUserConnector", () => ({
  appUserReconnectRequired: async () => false,
  callAsAppUser: async ({ path, requiredScopes }: { path: string; requiredScopes: string[] }) => {
    fx.requests.push(path);
    expect(requiredScopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    const url = new URL(path, "https://google.test");
    if (path.endsWith("/profile")) return Response.json({ emailAddress: "qa@example.invalid" });
    if (url.pathname.endsWith("/messages")) {
      expect(url.searchParams.get("q")).toContain("-category:promotions");
      return Response.json({ messages: [{ id: "invoice" }, { id: "newsletter" }] });
    }
    if (url.searchParams.get("format") === "metadata")
      return Response.json({
        payload: {
          headers: [
            {
              name: "Subject",
              value: path.includes("newsletter") ? "Weekly newsletter" : "Purchase invoice",
            },
          ],
        },
      });
    if (path.includes("newsletter")) throw Error("Newsletter fetched beyond metadata");
    if (path.includes("/attachments/"))
      return Response.json({ data: Buffer.from("%PDF-fixture").toString("base64url") });
    return Response.json({
      payload: {
        parts: [
          {
            filename: "invoice.pdf",
            mimeType: "application/pdf",
            body: { size: 12, attachmentId: "fixture-file" },
          },
        ],
      },
    });
  },
}));
import { scanGmail } from "./google-scan.server";
beforeEach(() => {
  fx.requests.length = 0;
  fx.queued.clear();
  fx.watermark = 0;
  fx.disconnected = false;
});
it("filters a synthetic newsletter, queues exact attachment bytes and skips a repeated attachment before extraction", async () => {
  const first = await scanGmail("fixture-user", null);
  expect(first).toMatchObject({ created: 1, checked: 2 });
  expect([...fx.queued.values()]).toEqual([{ name: "invoice.pdf", bytes: "%PDF-fixture" }]);
  expect(fx.watermark).toBeGreaterThan(0);
  const second = await scanGmail("fixture-user", null);
  expect(second).toMatchObject({ created: 0, alreadyImported: 1 });
  expect(fx.requests.filter((p) => p.includes("/attachments/"))).toHaveLength(1);
});
it("stops before requesting messages when the connector grant was deleted", async () => {
  fx.disconnected = true;
  await expect(scanGmail("fixture-user", null)).rejects.toThrow();
  expect(fx.requests).toHaveLength(0);
});
