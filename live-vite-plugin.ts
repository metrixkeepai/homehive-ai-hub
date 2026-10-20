import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { attachVoice } from "./server/voice.mjs";
export function liveVoiceDev(): Plugin {
  let mode = "development";
  return {
    name: "matrixkeep-voice",
    configResolved(config) {
      mode = config.mode;
    },
    configureServer(server) {
      if (server.httpServer)
        attachVoice(server.httpServer, { ...process.env, ...loadEnv(mode, process.cwd(), "") });
    },
  };
}
