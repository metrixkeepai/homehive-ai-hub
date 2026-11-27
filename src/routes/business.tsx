import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/marketing/AudiencePage";
import { marketingHead } from "@/components/marketing/content";
import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/business")({
  head: () =>
    marketingHead(
      "MatrixKeep for Business | Equipment, Evidence & Renewals",
      "Connect business equipment, locations, invoices, warranties and maintenance records. Explore SME plans and an illustrative productivity calculator.",
      "/business",
      photos.cafe,
    ),
  component: () => <AudiencePage audience="business" />,
});
