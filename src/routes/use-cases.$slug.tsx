import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoryPage } from "@/components/hv/StoryPage";
import { useCases } from "@/components/hv/siteContent";

export const Route = createFileRoute("/use-cases/$slug")({
  loader: ({ params }) => {
    const s = useCases.find((x) => x.slug === params.slug);
    if (!s) throw notFound();
    return { slug: s.slug };
  },
  head: ({ loaderData }) => {
    const s = useCases.find((x) => x.slug === loaderData?.slug);
    if (!s) return { meta: [{ title: "Not found — MatrixKeep" }, { name: "robots", content: "noindex" }] };
    return { meta: [
      { title: `${s.t} — MatrixKeep` }, { name: "description", content: s.lead },
      { property: "og:title", content: `${s.t} — MatrixKeep` }, { property: "og:description", content: s.short },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useLoaderData();
  const s = useCases.find((x) => x.slug === slug)!;
  return <StoryPage s={s} kind="use-cases" others={useCases} />;
}
