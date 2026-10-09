// @lovable.dev/vite-tanstack-config already includes core plugins — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { liveVoiceDev } from "./live-vite-plugin";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: { plugins: [liveVoiceDev()] },
});
