import { z } from "zod";

export const extractionSchema = z.object({
  transcript: z.string(),
  intent: z.enum(["sale", "payment", "supplier_order", "unknown"]),
  customer_name: z.string().nullable(),
  items: z.array(
    z.object({
      product: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      price: z.number().nullable(),
    })
  ),
  amount_total: z.number().nullable(),
  amount_paid: z.number().nullable(),
  amount_credit: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  uncertainties: z.array(z.string()),
});

export type Extraction = z.infer<typeof extractionSchema>;
