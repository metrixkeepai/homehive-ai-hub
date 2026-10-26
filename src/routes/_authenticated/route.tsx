import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Finish PKCE/OAuth before the auth gate, so Google return never bounces through /auth. */
async function resolveOAuthReturn(searchStr: string) {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const params = new URLSearchParams(raw);
  const code = params.get("code");
  const oauthError = params.get("error_description") || params.get("error");

  if (oauthError && !code) {
    throw redirect({ to: "/auth" });
  }

  if (!code) return false;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  }

  return true;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const exchanged = await resolveOAuthReturn(location.searchStr);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Strip ?code=&state= after a successful SSO return.
    if (exchanged && location.searchStr) {
      throw redirect({ to: "/app", replace: true });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
