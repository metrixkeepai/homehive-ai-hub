import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/how-it-works")({
  head: () =>
    marketingHead(
      "How MatrixKeep Works | From Capture to Connected Records",
      "Capture information, review extracted details, connect assets and find the evidence you need to act.",
      "/how-it-works",
    ),
  component: () => <ProductPage kind="how-it-works" />,
});
