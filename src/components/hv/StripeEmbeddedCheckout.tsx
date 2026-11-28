import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";

interface StripeEmbeddedCheckoutProps {
  expectedVoucher?: string | null;
  plan: string;
  interval: "monthly" | "yearly";
}

export function StripeEmbeddedCheckout({
  plan,
  interval,
  expectedVoucher,
}: StripeEmbeddedCheckoutProps) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof createCheckoutSession>> | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    setResult(null);
    async function start() {
      try {
        const response = await createCheckoutSession({
          data: { plan, interval, expectedVoucher },
        });
        if (active) setResult(response);
      } catch {
        if (active)
          setResult({ error: "Checkout could not start. Close this window and try again." });
      }
    }
    void start();
    return () => {
      active = false;
    };
  }, [plan, interval, expectedVoucher]);

  if (!result) return <p role="status">Preparing checkout…</p>;
  if ("error" in result) return <p role="alert">{result.error}</p>;
  if ("portalUrl" in result)
    return (
      <a className="underline" href={result.portalUrl}>
        Review your subscription in Stripe
      </a>
    );
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ clientSecret: result.clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
