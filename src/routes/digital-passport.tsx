import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/digital-passport")({
  head: () =>
    marketingHead(
      "Digital Asset Passport | MatrixKeep",
      "Connect purchase evidence, warranties and lifecycle records in a Digital Asset Passport. Explore an interactive illustrative example.",
      "/digital-passport",
    ),
  component: () => <ProductPage kind="digital-passport" />,
});
