import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/sera")({
  head: () =>
    marketingHead(
      "Meet Sera AI | Answers from Your MatrixKeep Records",
      "Ask Sera everyday questions about saved assets, warranties and important dates. Try an isolated scripted demonstration.",
      "/sera",
    ),
  component: () => <ProductPage kind="sera" />,
});
