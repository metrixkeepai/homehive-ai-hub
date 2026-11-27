import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, FAQ, CTA } from "@/components/hv/Site";
import { MarketingPricing } from "@/components/marketing/Demos";
import { marketingHead, commonFaq } from "@/components/marketing/content";
export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(
      "MatrixKeep Pricing | Individual, Business & Enterprise Plans",
      "Compare current MatrixKeep plans, prices and published allowances. Start Free or explore the 14-day Business Starter trial.",
      "/pricing",
    ),
  component: () => (
    <SiteShell>
      <MarketingPricing comparison />
      <FAQ
        items={[
          commonFaq[10],
          [
            "What happens when the Business Starter trial ends?",
            "If you do not continue with a paid plan, the workspace becomes read-only. Saved records are not deleted. Only Business Starter has a 14-day trial.",
          ],
          [
            "How do I use a voucher?",
            "Redeem an eligible voucher in the existing Plans page after signing in.",
          ],
          [
            "Are prices in pounds?",
            "Yes. Prices are displayed in GBP. Review the billing period and checkout terms before subscribing.",
          ],
        ].filter((x): x is [string, string] => Boolean(x))}
      />
      <CTA
        title="Start with what matters today."
        lead="Choose more space and capabilities when you need them."
      />
    </SiteShell>
  ),
});
