import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/features")({
  head: () =>
    marketingHead(
      "Platform Overview | MatrixKeep AI Asset Intelligence",
      "Connect assets, receipts, warranties, maintenance, evidence and renewals in one AI-powered workspace.",
      "/features",
    ),
  component: () => <ProductPage kind="features" />,
});
