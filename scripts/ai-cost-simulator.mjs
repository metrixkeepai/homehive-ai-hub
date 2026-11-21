// node scripts/ai-cost-simulator.mjs scenario.json
// USD throughout. Each plan supplies its own observed usage mix and net monthly revenue.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
function number(name, value, max = Infinity) {
  if (!Number.isFinite(value) || value < 0 || value > max) throw Error("Invalid " + name);
  return value;
}
function inference(input, output, cached, rates) {
  return (
    (input * ((1 - cached) * rates.input + cached * rates.cached) + output * rates.output) / 1e6
  );
}
export function simulate(s) {
  const users = number("registered users", s.users),
    days = number("days", s.days, 366);
  if (!days || !Array.isArray(s.plans) || !s.plans.length)
    throw Error("Specify plans and billing days");
  for (const rate of [s.luna, s.sol])
    for (const key of ["input", "cached", "output"]) number(key, rate[key]);
  const byPlan = [],
    byFeature = {};
  let totalRevenue = 0,
    totalCost = 0,
    totalShare = 0,
    paid = 0;
  for (const p of s.plans) {
    totalShare += number("plan share", p.share, 1);
    const subscribers = users * p.share,
      active =
        subscribers *
        number("DAU fraction", p.dau, 1) *
        number("AI-active fraction", p.aiActive, 1);
    const revenue = subscribers * number("net monthly revenue per subscriber", p.revenueUsd);
    let monthly = 0,
      maximum = 0,
      unlimited = false;
    for (const f of p.features) {
      const usage = number("calls per active day", f.calls),
        input = number("average input", f.input),
        output = number("average output", f.output);
      const cached = number("cached input token fraction", f.cached, 1),
        escalation = number("escalation probability", f.escalation, 1),
        reuse = number("application reuse probability", f.reuse, 1);
      const unit =
        (1 - reuse) *
        (inference(input, output, cached, s.luna) +
          escalation * inference(input, output, cached, s.sol) +
          number("audio minutes", f.minutes ?? 0) * number("audio USD/min", s.audioPerMinute));
      const cost = active * usage * days * unit;
      monthly += cost;
      byFeature[f.name] = (byFeature[f.name] ?? 0) + cost;
      // Allowances sharing one entitlement pool must be supplied as one feature with a blended unit cost.
      if (f.allowance === null) unlimited = true;
      else maximum += number("monthly allowance", f.allowance) * unit;
    }
    totalCost += monthly;
    totalRevenue += revenue;
    if (p.revenueUsd > 0) paid += subscribers;
    byPlan.push({
      plan: p.name,
      monthlyRevenueUsd: revenue,
      monthlyAiUsd: monthly,
      averageAiPerSubscriberUsd: subscribers ? monthly / subscribers : 0,
      aiAtFullAllowancePerSubscriberUsd: unlimited ? null : maximum,
      negativeAtFullAllowance: unlimited ? null : maximum > p.revenueUsd,
      aiContributionUsd: revenue - monthly,
      negativeAtExpectedUsage: monthly > revenue,
    });
  }
  if (Math.abs(totalShare - 1) > 1e-6) throw Error("Plan shares must sum to 1");
  const other = number("monthly non-AI cost of service", s.otherMonthlyCogsUsd);
  return {
    dailyApiUsd: totalCost / days,
    monthlyApiUsd: totalCost,
    perRegisteredUsd: users ? totalCost / users : 0,
    perPaidUsd: paid ? totalCost / paid : null,
    byFeature,
    byPlan,
    grossMargin: totalRevenue ? (totalRevenue - totalCost - other) / totalRevenue : null,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(simulate(JSON.parse(readFileSync(process.argv[2], "utf8"))), null, 2));
