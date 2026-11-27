import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoryPage } from "@/components/hv/StoryPage";
import { industries } from "@/components/hv/siteContent";

import { storyPhoto } from "@/components/marketing/media";
export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const s = industries.find((x) => x.slug === params.slug);
    if (!s) throw notFound();
    return { slug: s.slug };
  },
  head: ({ loaderData }) => {
    const s = industries.find((x) => x.slug === loaderData?.slug);
    if (!s)
      return {
        meta: [{ title: "Not found — MatrixKeep" }, { name: "robots", content: "noindex" }],
      };
    return {
      links: [{ rel: "canonical", href: `https://matrixkeep.com/industries/${s.slug}` }],
      meta: [
        { title: `${s.t} — MatrixKeep` },
        { name: "description", content: s.lead },
        { property: "og:title", content: `${s.t} — MatrixKeep` },
        { property: "og:description", content: s.short },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useLoaderData();
  const s = industries.find((x) => x.slug === slug);
  if (!s) return null;
  return <StoryPage s={s} kind="industries" others={industries} />;
}
