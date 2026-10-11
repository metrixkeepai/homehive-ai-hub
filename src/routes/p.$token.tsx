import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/hv/Logo";

export const Route = createFileRoute("/p/$token")({
  head: () => ({ meta: [
    { title: "Shared Digital Passport — MatrixKeep" },
    { name: "description", content: "A read-only MatrixKeep Digital Passport shared with you." },
    { property: "og:title", content: "Shared Digital Passport — MatrixKeep" },
    { property: "og:description", content: "A read-only MatrixKeep Digital Passport shared with you." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Logo />
        {data && <span className="text-xs text-muted-foreground">Read-only guest view · expires {new Date(data.expires_at).toLocaleDateString("en-GB")}</span>}
      </header>
      {isLoading ? <p className="p-10 text-center text-muted-foreground">Opening passport…</p>
        : !data ? <div className="mx-auto max-w-md p-12 text-center"><h1 className="font-display text-3xl">This link isn't available</h1><p className="mt-2 text-muted-foreground">It may have expired or been revoked by its owner. Ask them for a new link.</p></div>
        : <iframe title={data.title} srcDoc={data.html} sandbox="allow-modals" className="h-[calc(100vh-57px)] w-full border-0" />}
    </div>
  );
}
