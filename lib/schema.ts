import { z } from "zod";

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null));

const nullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
    return null;
  });

const itemSchema = z
  .object({
    product: nullableString,
    quantity: nullableNumber,
    unit: nullableString,
    price: nullableNumber,
  })
  .transform((item) => ({
    product: item.product ?? "",
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
  }))
  .refine((item) => item.product.length > 0, { message: "product required" });

export const extractionSchema = z
  .object({
    transcript: z.string().default(""),
    intent: z
      .enum(["sale", "payment", "supplier_order", "unknown"])
      .catch("unknown"),
    customer_name: nullableString,
    items: z.array(z.any()).catch([]),
    amount_total: nullableNumber,
    amount_paid: nullableNumber,
    amount_credit: nullableNumber,
    confidence: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) return 0.5;
        return Math.min(1, Math.max(0, n));
      }),
    uncertainties: z.array(z.string()).catch([]),
  })
  .transform((raw) => {
    const items = [];
    const uncertainties = [...raw.uncertainties];
    for (const entry of raw.items) {
      const parsed = itemSchema.safeParse(entry);
      if (parsed.success) items.push(parsed.data);
      else uncertainties.push("Un article n'a pas pu être identifié clairement.");
    }
    return { ...raw, items, uncertainties: [...new Set(uncertainties)] };
  });

export type Extraction = z.infer<typeof extractionSchema>;
