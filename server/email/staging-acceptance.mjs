import { createHash } from "node:crypto";
import { deliverEmail } from "./delivery.mjs";

import { billingOwners } from "./ownership.mjs";
export { billingOwners };

export async function exerciseControlledDelivery({ sql, send, environment, to }) {
  const approved = {
    staging: "metrixkeepai+emailqa20261126@gmail.com",
    production: "zaineluvathingal@gmail.com",
  };
  if (!Object.hasOwn(approved, environment) || to !== approved[environment])
    throw Error("Unexpected mail acceptance recipient");
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
    security_event: "Controlled notification delivery test",
    event_date: date,
    event_context: "MatrixKeep QA",
  };
  const occurrence = environment + "-delivery-acceptance-20261127";
  for (const kind of [
    ...(environment === "production" ? ["welcome"] : []),
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
      occurrence,
    });
    const deliveryKey = createHash("sha256")
      .update(JSON.stringify([environment, kind, occurrence, to]))
      .digest("hex");
    const [receipt] =
      await sql`SELECT state FROM matrixkeep_mail.delivery WHERE delivery_key=${deliveryKey}`;
    if (receipt?.state !== "sent") throw Error("QA delivery has no sent receipt");
    console.log("Controlled delivery acceptance", kind, result);
    if (!["sent", "already-claimed"].includes(result)) throw Error("Unexpected delivery outcome");
  }
}
