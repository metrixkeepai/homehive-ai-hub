import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/marketing/ProductPage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/partners")({
  head: () =>
    marketingHead(
      "Pilot & Partner Opportunities | MatrixKeep",
      "Discuss scoped pilots, strategic partnerships and responsible enterprise asset intelligence with MatrixKeep.",
      "/partners",
    ),
  component: () => <ProductPage kind="partners" />,
});
