import { normalize } from "./matchCustomer";
import type { Extraction, Product, TransactionItem } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Complète le prix manquant avec le rayon, puis calcule total, payé et crédit. */
export function priceSale(extraction: Extraction, products: Product[]) {
  const items: TransactionItem[] = extraction.items.map((it) => {
    const product = products.find(
      (p) => normalize(p.name_fr) === normalize(it.product) || normalize(p.name_darija) === normalize(it.product),
    );
    return {
      product: product?.name_fr ?? it.product,
      quantity: it.quantity ?? 1,
      unit: it.unit ?? product?.unit ?? "pcs",
      price: it.price ?? product?.price ?? 0,
    };
  });

  const itemsTotal = round(items.reduce((s, it) => s + it.quantity * it.price, 0));
  let total: number;
  let paid: number;
  let credit: number;

  if (extraction.intent === "payment") {
    paid = extraction.amount_paid ?? extraction.amount_total ?? 0;
    total = paid;
    credit = 0;
  } else {
    total =
      extraction.amount_total ??
      (extraction.amount_paid !== null && extraction.amount_credit !== null
        ? extraction.amount_paid + extraction.amount_credit
        : itemsTotal);
    paid =
      extraction.amount_paid ??
      (extraction.amount_credit !== null ? Math.max(0, total - extraction.amount_credit) : 0);
    credit = extraction.amount_credit ?? Math.max(0, round(total - paid));
  }

  return {
    items,
    total: round(total),
    paid: round(paid),
    credit: round(credit),
    pricedFromShelf: extraction.amount_total === null && items.some((it) => it.price > 0),
  };
}
