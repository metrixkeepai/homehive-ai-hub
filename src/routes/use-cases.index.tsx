import { createFileRoute } from "@tanstack/react-router";
import { StoryIndex } from "@/components/hv/StoryPage";
import { useCases } from "@/components/hv/siteContent";

import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/use-cases/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://matrixkeep.com/use-cases" }],
    meta: [
      { title: "Use cases — MatrixKeep" },
      {
        name: "description",
        content:
          "Home inventory, warranty and renewal tracking, insurance claims, passport transfer, multi-location assets and more.",
      },
      { property: "og:title", content: "Use cases — MatrixKeep" },
      { property: "og:description", content: "See what you can do with MatrixKeep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <StoryIndex
      kind="use-cases"
      title="Built for the moments that matter."
      lead="Discover practical ways MatrixKeep helps individuals and businesses stay organised and informed."
      items={useCases}
    />
  ),
});
