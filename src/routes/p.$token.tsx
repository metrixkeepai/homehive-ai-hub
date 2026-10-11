import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/hv/Logo";
import { isEntity, OG_DESCRIPTION, OG_IMAGE, OG_TITLE, SITE, type PassportEntity } from "@/lib/passport-share";

export const Route = createFileRoute("/p/$token")({
  validateSearch: (s: Record<string, unknown>): { k?: PassportEntity } => (isEntity(s['k']) ? { k: s['k'] } : {}),
  // Privacy-safe preview: only the passport type is used — never owner, address or record details.
  head: ({ match, params }) => {
    const k: PassportEntity = (match.search as { k?: PassportEntity }).k ?? "other";
    const title = OG_TITLE[k];
    const image = `${SITE}/og/${OG_IMAGE[k]}.jpg`;
    const url = `${SITE}/p/${params.token}?k=${k}`;
    return { meta: [
      { title },
      { name: "description", content: OG_DESCRIPTION },
      { property: "og:title", content: title },
      { property: "og:description", content: OG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MatrixKeep" },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: OG_DESCRIPTION },
      { name: "twitter:image", content: image },
      { name: "robots", content: "noindex, nofollow" },
    ] };
  },
  component: Guest,
});

function Guest() {
  const { token } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["share", token], queryFn: async () => {
    const { data, error } = await supabase.rpc("open_passport_share", { _token: token });
    if (error) throw error; return data?.[0] ?? null;
  }, retry: 1, staleTime: Infinity });
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-6 py-3">
        <Logo />
        <div className="flex items-center gap-4">
          {data && <span className="hidden text-xs text-muted-foreground sm:inline">Read-only guest view · expires {new Date(data.expires_at).toLocaleDateString("en-GB")}</span>}
          <a href="/" target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">Discover MatrixKeep</a>
        </div>
      </header>
      {isLoading ? <p className="p-10 text-center text-muted-foreground">Opening passport…</p>
        : !data ? <div className="mx-auto max-w-md p-12 text-center"><h1 className="font-display text-3xl">This link isn't available</h1><p className="mt-2 text-muted-foreground">It may have expired or been revoked by its owner. Ask them for a new link.</p></div>
        : <iframe title={data.title} srcDoc={data.html} sandbox="allow-modals" className="h-[calc(100vh-57px)] w-full border-0" />}
    </div>
  );
}
