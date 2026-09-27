import { NextResponse } from "next/server";
import { normalize } from "@/lib/matchCustomer";
import { pointsForPurchase } from "@/lib/points";
import { buildReminder } from "@/lib/reminder";
import { getState, saveState } from "@/lib/store";
import type { ConfirmResponse, Customer, Extraction, Transaction, TransactionItem } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/ledger → état complet de la Karna */
export async function GET() {
  return NextResponse.json(getState());
}

type ConfirmBody = {
  extraction: Extraction;
  customerId?: string | null;
  newCustomerName?: string | null;
  source?: "voice" | "text" | "mock";
};

/**
 * POST /api/ledger → enregistre une transaction confirmée par l'épicier.
 * C'est ici, et seulement ici, que la Karna change.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ConfirmBody | null;
  if (!body?.extraction) {
    return NextResponse.json({ error: "Extraction manquante." }, { status: 400 });
  }

  const state = getState();
  const { extraction } = body;

  // 1. Le client
  let customer: Customer | null = null;
  if (body.customerId) {
    customer = state.customers.find((c) => c.id === body.customerId) ?? null;
    if (!customer) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  } else if (body.newCustomerName?.trim()) {
    customer = {
      id: `c${state.customers.length + 1}`,
      name: body.newCustomerName.trim(),
      phone: `2126000000${String(state.customers.length + 1).padStart(2, "0")}`,
      balance: 0,
      points: 0,
    };
    state.customers.push(customer);
  }

  // 2. Les articles : on complète quantité, unité et prix avec le catalogue du hanout
  const items: TransactionItem[] = extraction.items.map((it) => {
    const product = state.products.find(
      (p) => normalize(p.name_fr) === normalize(it.product) || normalize(p.name_darija) === normalize(it.product),
    );
    return {
      product: product?.name_fr ?? it.product,
      quantity: it.quantity ?? 1,
      unit: it.unit ?? product?.unit ?? "pcs",
      price: it.price ?? product?.price ?? 0,
    };
  });

  // 3. Les montants : on croit la phrase quand elle est complète, sinon on calcule
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
    paid = extraction.amount_paid ?? (extraction.amount_credit !== null ? Math.max(0, total - extraction.amount_credit) : total);
    credit = extraction.amount_credit ?? Math.max(0, round(total - paid));
  }

  // 4. Solde + points fidélité (1 point / 10 dh d'achat)
  const pointsEarned = extraction.intent === "sale" ? pointsForPurchase(total) : 0;
  if (customer && extraction.intent === "sale") {
    customer.balance = round(customer.balance + credit);
    customer.points = (customer.points ?? 0) + pointsEarned;
  }
  if (customer && extraction.intent === "payment") customer.balance = round(customer.balance - paid);

  const transaction: Transaction = {
    id: `t${state.transactions.length + 1}`,
    customerId: customer?.id ?? null,
    intent: extraction.intent,
    items,
    amount_total: round(total),
    amount_paid: round(paid),
    amount_credit: round(credit),
    createdAt: new Date().toISOString(),
    source: body.source ?? "text",
    transcript: extraction.transcript,
    confidence: extraction.confidence,
    pointsEarned,
  };
  state.transactions.push(transaction);
  saveState(state);

  const reminder =
    customer && (extraction.intent === "sale" || extraction.intent === "payment")
      ? buildReminder(customer, transaction, state.shop.name)
      : null;

  const payload: ConfirmResponse = { transaction, customer, reminder, state };
  return NextResponse.json(payload);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
