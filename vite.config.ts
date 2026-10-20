// @lovable.dev/vite-tanstack-config already includes core plugins — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { NitroConfig } from "nitro/types";

import { liveVoiceDev } from "./live-vite-plugin";

// The custom Node host mounts Nitro directly, so Nitro must serve its build assets.
const nitroConfig = { preset: "node-middleware", serveStatic: true } satisfies NitroConfig;

export default defineConfig({
  vite: { plugins: [liveVoiceDev()] },
  nitro: nitroConfig,
  tanstackStart: {
    server: { entry: "server" },
  },
});
