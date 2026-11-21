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
  assert.equal(translationRisk("65 £", "€65", "fr"), "units");
});
