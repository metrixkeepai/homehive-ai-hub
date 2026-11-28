import { test } from "node:test";
import assert from "node:assert/strict";
import { voucherPrice, discountMonths, trialBillingDate } from "../../src/lib/voucher-terms.ts";
test("voucher quote uses GBP minor units, rounding and a zero floor", () => {
  assert.equal(voucherPrice(1499, { type: "discount_percent", value: 90 }), 150);
  assert.equal(voucherPrice(2900, { type: "discount_fixed", value: 10 }), 1900);
  assert.equal(voucherPrice(300, { type: "discount_fixed", value: 10 }), 0);
  assert.equal(voucherPrice(2900, { type: "free_period" }), 0);
});
test("fixed end dates respect month-end billing anniversaries", () => {
  assert.equal(discountMonths(new Date("2027-01-31T10:00Z"), new Date("2027-02-28T10:00Z")), 1);
  assert.equal(discountMonths(new Date("2027-01-31T10:00Z"), new Date("2027-03-01T00:00Z")), 2);
});

test("free-period quote shows first paid date for relative and inclusive fixed periods", () => {
  assert.equal(
    trialBillingDate({ months: 1, end: null }, new Date("2027-01-31T20:00:00Z")),
    "28 February 2027",
  );
  assert.equal(trialBillingDate({ months: null, end: "2027-02-28" }), "1 March 2027");
});
