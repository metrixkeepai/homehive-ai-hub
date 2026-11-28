export type VoucherOffer = {
  code: string;
  plan: string;
  type: "discount_fixed" | "discount_percent" | "free_period";
  value: number | null;
  months: number | null;
  end: string | null;
};

export function voucherPrice(pence: number, offer: VoucherOffer) {
  if (offer.type === "free_period") return 0;
  if (!Number.isInteger(pence) || pence < 0 || !offer.value || offer.value <= 0)
    throw new Error("Invalid voucher price");
  const discount =
    offer.type === "discount_fixed"
      ? Math.round(offer.value * 100)
      : Math.round((pence * Math.round(offer.value * 100)) / 10000);
  return Math.max(0, pence - discount);
}

// Count billing anniversaries strictly before the cutoff, using UTC month-end clamping.
export function discountMonths(start: Date, end: Date) {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  return months + Number(billingAnniversary(start, months) < end);
}

function billingAnniversary(start: Date, months: number) {
  const boundary = new Date(start);
  boundary.setUTCDate(1);
  boundary.setUTCMonth(boundary.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(boundary.getUTCFullYear(), boundary.getUTCMonth() + 1, 0),
  ).getUTCDate();
  boundary.setUTCDate(Math.min(start.getUTCDate(), last));
  return boundary;
}

export function trialBillingDate(offer: VoucherOffer, start = new Date()) {
  const date = offer.end
    ? new Date(offer.end + "T00:00:00Z")
    : billingAnniversary(start, offer.months ?? 0);
  if (offer.end) date.setUTCDate(date.getUTCDate() + 1);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
