import type { HttpServer } from 'vite';
import type { WebSocketServer } from 'ws';
export function attachVoice(server: HttpServer, env?: Record<string, string | undefined>): WebSocketServer;
