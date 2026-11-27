import { deliverEmail } from "./delivery.mjs";

export const billingOwners = Object.freeze({
  activated: "matrixkeep",
  upgraded: "matrixkeep",
  downgraded: "matrixkeep",
  cancelled: "matrixkeep",
});

export async function exerciseStagingDelivery({ sql, send, environment, to }) {
  if (environment !== "staging" || to !== "metrixkeepai+emailqa20261126@gmail.com")
    throw Error("Unexpected staging mail acceptance recipient");
  const date = "30 November 2026";
  const fields = {
    first_name: "MatrixKeep QA",
    plan_name: "Home",
    old_plan: "Home",
    new_plan: "Family",
    amount: "£4.99",
    billing_interval: "Monthly",
    renewal_date: date,
    effective_date: date,
    voucher_code_masked: "••••QA",
    voucher_benefit: "QA voucher",
    voucher_expiry: date,
    asset_name: "QA appliance",
    relative_date: "on " + date,
    expiry_date: date,
    provider_name: "QA provider",
    policy_name: "QA policy",
    covered_item: "QA property",
    document_name: "QA certificate",
    related_asset: "QA appliance",
    maintenance_type: "QA service",
    due_date: date,
    property_or_room: "QA kitchen",
    security_event: "Staging notification delivery test",
    event_date: date,
    event_context: "MatrixKeep staging QA",
  };
  for (const kind of [
    "activated",
    "upgraded",
    "downgraded",
    "cancelled",
    "voucher",
    "warranty",
    "insurance",
    "document",
    "maintenance",
    "security",
  ]) {
    const result = await deliverEmail({
      sql,
      send,
      kind,
      environment,
      to,
      fields,
      billingOwners,
      occurrence: "staging-delivery-acceptance-20261127",
    });
    console.log("Staging delivery acceptance", kind, result);
    if (!["sent", "already-claimed"].includes(result)) throw Error("Unexpected delivery outcome");
  }
}
