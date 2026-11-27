import test from "node:test";
import assert from "node:assert/strict";
import { hasExactGbp, numericEntities, translationRisk } from "../../src/lib/speech-facts.ts";
test("GBP assertions check the whole monetary value and currency", () => {
  for (const s of ["£65", "GBP 65.00", "65 pounds"]) assert.ok(hasExactGbp(s, 65), s);
  for (const s of ["£11.65", "£650", "£6.50", "€65", "£11.65 and 65 days", "£65 and £11.65"])
    assert.equal(hasExactGbp(s, 65), false, s);
});
test("translation preserves decimals and model identifiers across scripts", () => {
  assert.deepEqual(numericEntities("٦٥٫٥٠", "ar"), ["65.5"]);
  assert.equal(translationRisk("65,50 £", "£65.50", "fr"), null);
  assert.equal(translationRisk("65 £", "£11.65", "fr"), "numbers");
  assert.equal(translationRisk("Bosch TWK7203", "Bosch TVK7203", "fr"), "identifier");
  assert.equal(translationRisk("65 £", "€65", "fr"), "currency");
});

test("dates and amounts keep their meaning independently of numeral ordering", () => {
  assert.equal(translationRisk("hier", "today", "fr"), "date");
  assert.equal(translationRisk("20 novembre 2026", "20 October 2026", "fr"), "date");
  assert.equal(translationRisk("20 novembre 2026", "20 November 2026", "fr"), null);
  assert.equal(translationRisk("GBP 65 and EUR 20", "EUR 65 and GBP 20", "en"), "currency");
});

test("Malayalam to English accepts a script change and preserves price and day", () => {
  assert.equal(
    translationRisk(
      "ഇന്നലെ ₹2500 നൽകി വാച്ച് വാങ്ങി",
      "Yesterday I bought a watch for ₹2,500.",
      "ml",
    ),
    null,
  );
  assert.equal(
    translationRisk(
      "ഇന്നലെ ₹2500 നൽകി വാച്ച് വാങ്ങി",
      "Yesterday I bought a watch for ₹250.",
      "ml",
    ),
    "numbers",
  );
});

test("a Malayalam rupee symbol may translate to the English currency name", () => {
  assert.equal(translationRisk("വില ₹650", "Price 650 rupees", "ml"), null);
  assert.equal(translationRisk("വില ₹650", "Price 650 euros", "ml"), "currency");
});
