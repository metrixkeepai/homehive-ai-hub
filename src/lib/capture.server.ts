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
  /** User's local calendar day (YYYY-MM-DD) so "yesterday"/"last Friday" resolve correctly. */
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
  const speakLike = /speak|voice|email|import email|paste/i.test(data.mode);
  const dateRules = speakLike
    ? `DATE RULES (spoken/written narrative — mode "${data.mode}"): When the user mentions when they bought, fitted, serviced or started something, ALWAYS fill "Purchase date", "Service date" and/or "Start date" with their exact wording — including relative phrases such as "yesterday", "today", "last Friday", "3 days ago", "15 March 2026". Do not invent dates they did not say. When they mention a warranty or cover length, fill both "Duration" and "Term" with that length (e.g. "three years", "approximately 3 years", "12 months") and copy the same purchase/start date onto the warranty record. Do not convert relative dates yourself; a later system turns them into YYYY-MM-DD.`
    : `DATE RULES (document/photo): Prefer YYYY-MM-DD when a full calendar date is clearly printed. You may also copy the printed form (e.g. 15/03/2026). Never invent or calculate dates that are not visible — omit those fields.`;
  const instructions = `You are MatrixKeep's capture agent. The user used "${data.mode}". Extract every distinct real-world record (items/assets, rooms, receipts/documents, warranties, vehicles, maintenance jobs, tasks, insurance policies) you can see or read. For a room photo list each visible item as an asset with a "Room" field. For a receipt create a document record AND one asset per purchased product with Brand, Model, Price, Purchase date, Retailer where known, plus a warranty record if a warranty term is stated. Always write final record text in British English, translating faithfully when needed; use the currency shown, else £. Never invent values you cannot see or hear — omit those fields. Keep titles short. Set relates_to to the exact title of the asset or vehicle (in this same list) that a maintenance, warranty, insurance or task record is about, otherwise an empty string. Not every receipt line is an asset: labour, call-out fees, delivery, VAT and parts used in a repair belong in the document/maintenance fields, not as assets. Maximum 15 records. relates_to may also name the document record. For a document record include all shared header fields you can read using these labels: Invoice number, Invoice date, Due date, Supplier, Supplier address, Supplier email, Supplier telephone, Bill to, Total, and one field per invoice line labelled "Line 1", "Line 2"… with value "description — qty × unit price = line total". For every other record created from that document include ONLY its own line-item data where visible: Category, Brand, Model, Serial number, Issue / Description, Quantity, Unit price, Line total, Purchase date or Service date, Room — never copy another line's description or amounts into it.  For any contract, agreement, tenancy, lease, policy, licence, subscription or certificate: the document record must include "Document type" (one of Contract, Agreement, Tenancy Agreement, Lease, Rental Agreement, Employment Contract, Supplier Contract, Customer Contract, Service Agreement, NDA, Insurance Policy, Warranty, Invoice, Receipt, Certificate, Licence, Maintenance Document, Vehicle Document, Property Document, Bank/Finance Document, Subscription Agreement, Utility Agreement, Software Licence, Purchase Agreement, Legal Document, HR Document, Compliance Document, Other) and where stated: Contract type, Parties, Provider, Landlord, Tenant, Reference, Property, Start date, End date, Term (e.g. "12 months"), Review date, Notice period (e.g. "90 days" or "3 months"), Notice deadline, Auto-renewal (Yes/No/Unknown), Renewal frequency, Rent / Payment, Payment frequency, Deposit, Break clause, Confidence (High/Medium/Needs review). ${dateRules} If the document has an end, expiry, renewal or review date, a term, or an auto-renewal clause, ALSO create one "renewals" record (title like "Tenancy Agreement — 14 Elm Grove") with Provider, Category, Start date, Term, Renewal date (only if printed), Notice period, Notice deadline (only if printed), Auto-renewal, Reference, Confidence, and set its relates_to to the document record's exact title. Always classify any uploaded document even without dates. For imported order or warranty emails, include one document record identifying the source email by its stated subject and sender. Link extracted records only to records actually returned. Return JSON.`;
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
  const { reserveOperation, reserveQualityRetry } = await import("./operation.server");
  const { responseText, AIProviderError } = await import("./openai.server");
  const { cachedOperation } = await import("./ai-cache.server");
  try {
    return await cachedOperation(
      userId,
      data.workspaceId ?? null,
      data.images?.length ? "video" : "capture",
      "capture-v1-luna-sol-schema1",
      [instructions, schema, data],
      async () => {
        const reservation = await reserveOperation(
          userId,
          data.workspaceId ?? null,
          data.images?.length ? "video" : "capture",
          1,
          data.images?.length
            ? 0.006 + 0.003 * data.images.length
            : data.image?.startsWith("data:application/pdf")
              ? 0.03
              : data.image
                ? 0.01
                : 0.004 + data.text.length * 0.0000001,
        );
        const extract = (maxOutput: number, escalate = false) =>
          responseText({
            userId,
            feature: "capture",
            workspaceId: data.workspaceId ?? null,
            instructions,
            input: [{ role: "user", content }],
            maxOutput,
            escalate,
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
        const parse = (value: string) =>
          z
            .object({ summary: z.string().max(4000), records: z.array(record).max(15) })
            .parse(JSON.parse(value));
        const lineCount = data.text
          .split(/\r?\n/)
          .filter((line) => /\d[.,]\d{2}\b/.test(line)).length;
        const contract = /contract|tenancy|lease|agreement/i.test(
          data.text + " " + (data.fileName ?? ""),
        );
        const ceiling = contract
          ? 3500
          : lineCount > 4
            ? 3000
            : data.images?.length || /room/i.test(data.mode)
              ? 2500
              : /receipt/i.test(data.mode)
                ? 1500
                : 2000;
        let parsed;
        try {
          parsed = parse(await extract(ceiling));
          const titles = parsed.records.map((r) => r.title.trim().toLowerCase());
          if (
            parsed.records.some(
              (r) => r.relates_to && !titles.includes(r.relates_to.trim().toLowerCase()),
            )
          )
            throw new Error("unresolved_relationship");
        } catch (error) {
          const truncated =
            error instanceof AIProviderError && error.providerCode === "output_limit";
          if (error instanceof AIProviderError && !truncated) throw error;
          const invalid =
            error instanceof SyntaxError ||
            error instanceof z.ZodError ||
            (error instanceof Error && error.message === "unresolved_relationship");
          if (!invalid && !truncated) throw error;
          // Keep full evidence for the single corrective attempt; truncation alone does not warrant Sol.
          await reserveQualityRetry(userId, reservation, truncated ? 0.03 : 0.65);
          parsed = parse(await extract(6000, !truncated));
        }
        const { deriveContractDates } = await import("./contract-dates");
        const enriched = parsed.records.map((r) => {
          const pairs = r.fields.map((f) => [f.label, f.value] as [string, string]);
          // Warranties often omit the purchase date that was stated on the linked asset.
          if (
            ["warranties", "maintenance", "insurance", "renewals", "tasks"].includes(r.section) &&
            r.relates_to.trim()
          ) {
            const related = parsed.records.find(
              (o) => o.title.trim().toLowerCase() === r.relates_to.trim().toLowerCase(),
            );
            const hasStart = pairs.some(
              ([l, v]) =>
                /^(purchase date|start date|service date|invoice date|installed date)$/i.test(l) &&
                v.trim(),
            );
            if (related && !hasStart) {
              const fromRelated = related.fields.find((f) =>
                /^(purchase date|start date|service date|invoice date|installed date)$/i.test(
                  f.label,
                ),
              );
              if (fromRelated?.value.trim()) pairs.push([fromRelated.label, fromRelated.value]);
            }
          }
          const dateKey = r.section === "warranties" ? "Expiry date" : "Renewal date";
          const fields = deriveContractDates(pairs, dateKey, data.referenceDate).map(
            ([label, value]) => ({ label, value }),
          );
          const linked = r.relates_to.trim()
            ? parsed.records.filter(
                (other) =>
                  other !== r &&
                  other.title.trim().toLowerCase() === r.relates_to.trim().toLowerCase(),
              )
            : [];
          return { ...r, fields, relates_to: linked.length === 1 ? linked[0]!.title : "" };
        });
        return { summary: parsed.summary, records: enriched };
      },
    );
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
