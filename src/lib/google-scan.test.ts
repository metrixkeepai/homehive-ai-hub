import { beforeEach, afterEach, expect, it, vi } from "vitest";
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
vi.mock("./google-consent.server", () => ({
  googleAccess: async () => {
    if (fx.disconnected) throw Error("NOT_CONNECTED");
    return "fake-token";
  },
}));
beforeEach(() =>
  vi.stubGlobal("fetch", async (u: URL, init: RequestInit) => {
    expect(u.origin).toBe("https://www.googleapis.com");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer fake-token");
    const path = u.pathname + u.search;
    fx.requests.push(path);
    if (path.startsWith("/drive/v3/")) {
      const f = {
        id: "fixture-invoice",
        name: "invoice.pdf",
        mimeType: "application/pdf",
        size: "12",
        modifiedTime: "2026-11-20T00:00:00Z",
      };
      if (path.includes("/about?"))
        return Response.json({ user: { emailAddress: "drive@example.invalid" } });
      if (path.includes("/files?"))
        return Response.json({ files: [f, { ...f, id: "ignore", name: "holiday.jpg" }] });
      if (!path.includes(f.id)) throw Error("Irrelevant file fetched");
      return path.endsWith("?alt=media") ? new Response("%PDF-fixture") : Response.json(f);
    }

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
  }),
);
afterEach(() => vi.unstubAllGlobals());
import { scanGmail, scanDrive, importDrive } from "./google-scan.server";
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

it("discovers a Drive invoice and coalesces repeated explicit file imports", async () => {
  expect(await scanDrive("fixture-user", null)).toMatchObject({ created: 1, candidates: 1 });
  expect(await importDrive("fixture-user", null, "fixture-invoice")).toEqual({ created: 0 });
  expect(fx.requests.filter((x) => x.endsWith("?alt=media"))).toHaveLength(1);
  expect(fx.watermark).toBeGreaterThan(0);
  fx.disconnected = true;
  await expect(importDrive("fixture-user", null, "fixture-invoice")).rejects.toThrow();
});
