import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/ai-agents")({
  head: () =>
    marketingHead(
      "AI Agents | MatrixKeep Assisted Asset Intelligence",
      "Explore AI-assisted vision, document, warranty and renewal intelligence, with human review and a clearly labelled advanced roadmap.",
      "/ai-agents",
    ),
  component: () => <ProductPage kind="ai-agents" />,
});
