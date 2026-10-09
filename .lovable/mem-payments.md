---
name: Payment business rules
description: MatrixKeep Stripe subscription lifecycle rules chosen by the user
type: constraint
---
- On successful payment, the plan activates immediately.
- On cancellation, the customer keeps the paid plan until the end of the paid period, then drops to Free.
- Upgrades are pro-rated and take effect immediately.
- Downgrades take effect at the end of the current paid period.
- Prices in GBP; plans: home £4.99/£49, plus £9.99/£99, family £14.99/£149, business_starter £19/£190, business £29/£290, business_pro £79/£790, business_scale £149/£1490 (monthly/yearly).
