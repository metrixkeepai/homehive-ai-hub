import { describe, it, expect } from "vitest";
import { calculateRoi } from "./roi";
describe("illustrative business calculator", () => {
  it("uses 48 working weeks and annualises the monthly subscription", () => {
    const r = calculateRoi({
      employees: 3,
      hours: 4,
      hourlyCost: 25,
      reduction: 50,
      monthlyCost: 29,
      weeks: 48,
    });
    expect(r).toEqual({
      annualHours: 576,
      annualCost: 14400,
      recoveredHours: 288,
      productivityValue: 7200,
      subscriptionCost: 348,
      netBenefit: 6852,
    });
  });
  it("allows a negative net benefit without claiming savings", () => {
    expect(
      calculateRoi({
        employees: 1,
        hours: 1,
        hourlyCost: 10,
        reduction: 0,
        monthlyCost: 29,
        weeks: 48,
      }).netBenefit,
    ).toBe(-348);
  });
  it("caps percentage recovery at 100 percent", () => {
    expect(
      calculateRoi({
        employees: 1,
        hours: 1,
        hourlyCost: 10,
        reduction: 200,
        monthlyCost: 0,
        weeks: 48,
      }).recoveredHours,
    ).toBe(48);
  });
});
