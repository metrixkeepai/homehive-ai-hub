import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/about")({
  head: () =>
    marketingHead(
      "About MatrixKeep | Asset Intelligence by Scalivora AI",
      "Learn why Scalivora AI Ltd is building MatrixKeep for the things individuals and organisations own and operate.",
      "/about",
    ),
  component: () => <ProductPage kind="about" />,
});
