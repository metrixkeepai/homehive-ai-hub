import { createFileRoute } from "@tanstack/react-router";
import { StoryIndex } from "@/components/hv/StoryPage";
import { industries } from "@/components/hv/siteContent";

import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/industries/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://matrixkeep.com/industries" }],
    meta: [
      { title: "Industries — MatrixKeep" },
      {
        name: "description",
        content:
          "How healthcare, retail, education, property, construction and more use MatrixKeep to track assets, warranties and renewals.",
      },
      { property: "og:title", content: "Industries — MatrixKeep" },
      {
        property: "og:description",
        content: "Asset, warranty and renewal intelligence for every industry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <StoryIndex
      kind="industries"
      title="Different industries. One intelligent approach."
      lead="Discover how MatrixKeep helps organisations manage assets, evidence and operational information."
      items={industries}
    />
  ),
});
