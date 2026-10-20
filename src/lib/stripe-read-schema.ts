import { z } from "zod";
export const PaymentRecord = z.object({
  id: z.string(),
  created: z.number(),
  amount: z.number().optional(),
  amount_due: z.number().optional(),
  amount_paid: z.number().optional(),
  amount_remaining: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  billing_details: z.object({ email: z.string().nullable().optional() }).optional(),
  description: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  total: z.number().optional(),
  due_date: z.number().nullable().optional(),
  receipt_email: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  invoice_pdf: z.string().nullable().optional(),
  items: z
    .object({
      data: z.array(z.object({ price: z.object({ unit_amount: z.number().nullable() }) })),
    })
    .optional(),
  paid: z.boolean().optional(),
  refunded: z.boolean().optional(),
});
export const PaymentResponse = z.object({
  data: z.array(PaymentRecord).default([]),
  available: z.array(z.object({ amount: z.number(), currency: z.string() })).default([]),
  pending: z.array(z.object({ amount: z.number(), currency: z.string() })).default([]),
});
