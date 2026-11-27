import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/marketing/HomePage";
import { marketingHead } from "@/components/marketing/content";
export const Route = createFileRoute("/")({
  head: () => ({
    ...marketingHead(
      "MatrixKeep AI | Intelligent Asset Management for Homes & Businesses",
      "Manage assets, warranties, receipts, maintenance, insurance and renewals in one AI-powered platform. Built for individuals, families and businesses.",
      "/",
    ),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "MatrixKeep",
          url: "https://matrixkeep.com",
          description: "AI-powered Asset Intelligence and Digital Passport Platform",
        }),
      },
    ],
  }),
  component: HomePage,
});
