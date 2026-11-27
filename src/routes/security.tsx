import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/security")({
  head: () =>
    marketingHead(
      "Security & Privacy | MatrixKeep",
      "Learn about authenticated access, scoped records, controlled sharing and responsible AI in MatrixKeep.",
      "/security",
    ),
  component: () => <ProductPage kind="security" />,
});
