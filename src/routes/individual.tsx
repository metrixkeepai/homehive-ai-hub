import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/marketing/AudiencePage";
import { marketingHead } from "@/components/marketing/content";
import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/individual")({
  head: () =>
    marketingHead(
      "MatrixKeep for Individuals & Families | Home Asset Intelligence",
      "Organise home belongings, receipts, warranties, vehicles and property documents in one intelligent digital workspace.",
      "/individual",
      photos.family,
    ),
  component: () => <AudiencePage audience="individual" />,
});
