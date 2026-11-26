import { createHash } from 'node:crypto';
import { renderEmail } from './render.mjs';

const billing = new Set(['activated','upgraded','downgraded','payment_received','payment_failed','renewal','cancelled','trial_ending']);

// Call after a committed business event. Pass its stable logical occurrence key,
// not a webhook delivery ID. Each reminder occurrence needs its own due date.
export async function deliverEmail({ sql, send, kind, environment, occurrence, to, fields, billingOwners, recipientKey }) {
  if (billing.has(kind) && billingOwners?.[kind] !== 'matrixkeep') return 'externally-managed';
  if (typeof occurrence !== 'string' || !occurrence.trim()) throw Error('Missing business occurrence');
  if (typeof to !== 'string' || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/u.test(to)) throw Error('Invalid recipient');
  const message = renderEmail(kind, fields, environment);
  const key = createHash('sha256').update(JSON.stringify([environment,kind,occurrence,recipientKey ?? to.toLowerCase()])).digest('hex');
  const claimed = await sql`INSERT INTO matrixkeep_mail.delivery (delivery_key,state) VALUES (${key},'claimed')
    ON CONFLICT DO NOTHING RETURNING delivery_key`;
  if (!claimed.length) return 'already-claimed';
  try {
    await send({ ...message, to, idempotencyKey:key });
  } catch (error) {
    // SMTP can accept a message just before a timeout. Reconcile before replay.
    await sql`UPDATE matrixkeep_mail.delivery SET state='uncertain' WHERE delivery_key=${key}`;
    throw error;
  }
  await sql`UPDATE matrixkeep_mail.delivery SET state='sent' WHERE delivery_key=${key}`;
  return 'sent';
}
