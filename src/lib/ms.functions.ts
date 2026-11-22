import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
const provider = z.enum(["outlook", "onedrive"]);
export const msStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listConnectionsForUser } = await import("@/server/appUserConnections.server");
    return {
      configured: !!(
        process.env["MICROSOFT_CONNECTOR_CLIENT_ID"] &&
        process.env["MICROSOFT_CONNECTOR_CLIENT_SECRET"] &&
        process.env["APP_USER_CONNECTION_KEY_SECRET"]
      ),
      connections: (await listConnectionsForUser(context.userId)).filter(
        (c) => provider.safeParse(c.connector_id).success,
      ),
    };
  });
export const msStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider, origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) =>
    (await import("./ms-connector.server")).start(context.userId, data.provider, data.origin),
  );
export const msFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ provider, state: z.string().min(32).max(100), code: z.string().min(1).max(8192) })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    (await import("./ms-connector.server")).finish(
      context.userId,
      data.provider,
      data.state,
      data.code,
    ),
  );
export const msDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => provider.parse(d))
  .handler(async ({ data, context }) => {
    await (
      await import("@/server/appUserConnections.server")
    ).deleteConnectionForUser(context.userId, data);
  });
export const msBrowse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.string().max(90).parse(d))
  .handler(async ({ data, context }) =>
    (await import("./ms-connector.server")).browse(context.userId, data),
  );
export const msImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider,
        workspaceId: z.string().uuid().nullable(),
        fileId: z.string().min(1).max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.workspaceId) {
      const r = await context.supabase.rpc("can_access_workspace", {
        _workspace: data.workspaceId,
      });
      if (r.error || !r.data) throw Error("Workspace unavailable");
    }
    const s = { user: context.userId, ws: data.workspaceId, provider: data.provider };
    const m = await import("./ms-connector.server");
    if (data.provider === "outlook") return (await m.scanOutlook(s)).created;
    if (!data.fileId) throw Error("Select a file");
    return m.importMsFile(s, data.fileId);
  });
