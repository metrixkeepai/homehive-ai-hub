import { createClient } from "@supabase/supabase-js";

export function createReadinessClient(url, key, request = fetch) {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_secret_") && headers.get("authorization") === `Bearer ${key}`) {
          headers.delete("authorization");
        }
        headers.set("apikey", key);
        return request(input, { ...init, headers, signal: AbortSignal.timeout(3000) });
      },
    },
  });
}
