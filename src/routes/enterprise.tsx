import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/marketing/AudiencePage";
import { marketingHead } from "@/components/marketing/content";
import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/enterprise")({
  head: () =>
    marketingHead(
      "MatrixKeep Enterprise | Asset Intelligence & Operational Assurance",
      "Explore enterprise asset intelligence, connected evidence, responsible AI and scoped pilot opportunities with MatrixKeep.",
      "/enterprise",
      photos.enterprise,
    ),
  component: () => <AudiencePage audience="enterprise" />,
});
