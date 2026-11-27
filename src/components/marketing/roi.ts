export type RoiInputs = {
  employees: number;
  hours: number;
  hourlyCost: number;
  reduction: number;
  monthlyCost: number;
  weeks: number;
};
export function calculateRoi(i: RoiInputs) {
  const annualHours = Math.max(0, i.employees) * Math.max(0, i.hours) * Math.max(0, i.weeks);
  const annualCost = annualHours * Math.max(0, i.hourlyCost);
  const recoveredHours = (annualHours * Math.min(100, Math.max(0, i.reduction))) / 100;
  const productivityValue = recoveredHours * Math.max(0, i.hourlyCost);
  const subscriptionCost = Math.max(0, i.monthlyCost) * 12;
  return {
    annualHours,
    annualCost,
    recoveredHours,
    productivityValue,
    subscriptionCost,
    netBenefit: productivityValue - subscriptionCost,
  };
}
