import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/stripe-webhook.server");
        return handleStripeWebhook(request);
      },
    },
  },
});
