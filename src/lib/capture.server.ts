import { z } from "zod";

const SECTIONS = [
  "assets",
  "rooms",
  "documents",
  "warranties",
  "vehicles",
  "maintenance",
  "tasks",
  "insurance",
  "renewals",
] as const;

export const Input = z.object({
  mode: z.string().max(40),
  workspaceId: z.string().uuid().nullable().optional(),
  text: z.string().max(62000).default(""),
  image: z.string().max(7_000_000).optional(), // data URL
  images: z.array(z.string().max(1_500_000)).max(8).optional(), // video frames
  fileName: z.string().max(200).optional(),
});

export type Extracted = {
  section: (typeof SECTIONS)[number];
  title: string;
  subtitle: string;
  relates_to: string;
  fields: { label: string; value: string }[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "records"],
  properties: {
    summary: { type: "string" },
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "title", "subtitle", "relates_to", "fields"],
        properties: {
          section: { type: "string", enum: [...SECTIONS] },
          title: { type: "string" },
          subtitle: { type: "string" },
          relates_to: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value"],
              properties: { label: { type: "string" }, value: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

export async function runExtraction(
  data: z.infer<typeof Input>,
  userId: string | null,
): Promise<{ summary: string; records: Extracted[] } | { error: string }> {
  const { validateCaptureMedia } = await import("./capture-media.server");
  try {
    validateCaptureMedia(data);
  } catch {
    return {
      error:
        "Upload a valid JPEG, PNG, WebP or PDF within the capture size limits. Remote image URLs are not accepted.",
    };
  }
  const instructions = `You are MatrixKeep's capture agent. The user used "${data.mode}". Extract every distinct real-world record (items/assets, rooms, receipts/documents, warranties, vehicles, maintenance jobs, tasks, insurance policies) you can see or read. For a room photo list each visible item as an asset with a "Room" field. For a receipt create a document record AND one asset per purchased product with Brand, Model, Price, Purchase date, Retailer where known, plus a warranty record if a warranty term is stated. Always write final record text in British English, translating faithfully when needed; use the currency shown, else £. Never invent values you cannot see — omit those fields. Keep titles short. Set relates_to to the exact title of the asset or vehicle (in this same list) that a maintenance, warranty, insurance or task record is about, otherwise an empty string. Not every receipt line is an asset: labour, call-out fees, delivery, VAT and parts used in a repair belong in the document/maintenance fields, not as assets. Maximum 15 records. relates_to may also name the document record. For a document record include all shared header fields you can read using these labels: Invoice number, Invoice date, Due date, Supplier, Supplier address, Supplier email, Supplier telephone, Bill to, Total, and one field per invoice line labelled "Line 1", "Line 2"… with value "description — qty × unit price = line total". For every other record created from that document include ONLY its own line-item data where visible: Category, Brand, Model, Serial number, Issue / Description, Quantity, Unit price, Line total, Purchase date or Service date, Room — never copy another line's description or amounts into it.  For any contract, agreement, tenancy, lease, policy, licence, subscription or certificate: the document record must include "Document type" (one of Contract, Agreement, Tenancy Agreement, Lease, Rental Agreement, Employment Contract, Supplier Contract, Customer Contract, Service Agreement, NDA, Insurance Policy, Warranty, Invoice, Receipt, Certificate, Licence, Maintenance Document, Vehicle Document, Property Document, Bank/Finance Document, Subscription Agreement, Utility Agreement, Software Licence, Purchase Agreement, Legal Document, HR Document, Compliance Document, Other) and where stated: Contract type, Parties, Provider, Landlord, Tenant, Reference, Property, Start date, End date, Term (e.g. "12 months"), Review date, Notice period (e.g. "90 days" or "3 months"), Notice deadline, Auto-renewal (Yes/No/Unknown), Renewal frequency, Rent / Payment, Payment frequency, Deposit, Break clause, Confidence (High/Medium/Needs review). Write every date as YYYY-MM-DD and never calculate dates yourself — copy only dates printed in the document. If the document has an end, expiry, renewal or review date, a term, or an auto-renewal clause, ALSO create one "renewals" record (title like "Tenancy Agreement — 14 Elm Grove") with Provider, Category, Start date, Term, Renewal date (only if printed), Notice period, Notice deadline (only if printed), Auto-renewal, Reference, Confidence, and set its relates_to to the document record's exact title. Always classify any uploaded document even without dates. Return JSON.`;
  const content: unknown[] = [
    {
      type: "input_text",
      text:
        (data.text || "(no text provided)") +
        (data.fileName ? `\nFile name: ${data.fileName}` : ""),
    },
  ];
  if (data.image?.startsWith("data:application/pdf"))
    content.push({
      type: "input_file",
      filename: data.fileName ?? "document.pdf",
      file_data: data.image,
    });
  else if (data.image) content.push({ type: "input_image", image_url: data.image });
  if (data.images?.length) {
    content.push({
      type: "input_text",
      text: `The following ${data.images.length} images are frames from one video walkthrough, in order. Count each physical item once even if it appears in several frames.`,
    });
    for (const f of data.images) content.push({ type: "input_image", image_url: f });
  }
  if (!userId) return { error: "Please sign in to extract records." };
  const { reserveOperation } = await import("./operation.server");
  const { responseText } = await import("./openai.server");
  try {
    await reserveOperation(
      userId,
      data.workspaceId ?? null,
      data.images?.length ? "video" : "capture",
    );
    const out = await responseText({
      userId,
      feature: "capture",
      instructions,
      input: [{ role: "user", content }],
      maxOutput: 6000,
      format: { type: "json_schema", name: "records", strict: true, schema },
    });
    const record = z.object({
      section: z.enum(SECTIONS),
      title: z.string().min(1).max(200),
      subtitle: z.string().max(500),
      relates_to: z.string().max(200),
      fields: z
        .array(z.object({ label: z.string().max(100), value: z.string().max(4000) }))
        .max(60),
    });
    const parsed = z
      .object({ summary: z.string().max(4000), records: z.array(record).max(15) })
      .parse(JSON.parse(out));
    return parsed;
  } catch (error) {
    const { AIProviderError } = await import("./openai.server");
    return {
      error:
        error instanceof AIProviderError
          ? error.message
          : "Extraction is unavailable or its quota has been reached. Please try again later.",
    };
  }
}
