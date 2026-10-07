import { createFileRoute } from "@tanstack/react-router";
import { StoryIndex } from "@/components/hv/StoryPage";
import { industries } from "@/components/hv/siteContent";

export const Route = createFileRoute("/industries/")({
  head: () => ({
    meta: [
      { title: "Industries — MatrixKeep" },
      { name: "description", content: "How healthcare, retail, education, property, construction and more use MatrixKeep to track assets, warranties and renewals." },
      { property: "og:title", content: "Industries — MatrixKeep" },
      { property: "og:description", content: "Asset, warranty and renewal intelligence for every industry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StoryIndex kind="industries" title="Built for the way your industry works." lead="Every sector has its own equipment, checks and renewals. MatrixKeep keeps them all in one living record." items={industries} />,
});
