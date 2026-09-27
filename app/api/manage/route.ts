import { NextResponse } from "next/server";
import { deleteCustomer, updateProduct } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/manage → modifier un prix, un stock, ou retirer un client. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    price?: number;
    stock?: number;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  try {
    if (body.action === "product") {
      return NextResponse.json(updateProduct(body.id, { price: body.price, stock: body.stock }));
    }
    if (body.action === "delete-customer") {
      return NextResponse.json(deleteCustomer(body.id));
    }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Modification impossible.";
    const status = message.includes("introuvable") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
