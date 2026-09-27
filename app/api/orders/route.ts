import { NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/store";

export const runtime = "nodejs";

/** GET /api/orders → commandes passées sans venir au hanout. */
export async function GET() {
  return NextResponse.json({ orders: listOrders() });
}

/** POST /api/orders → un client envoie son panier. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    customerName?: string;
    phone?: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    arriveAt?: string;
    amountPaid?: number;
    lines?: { productId: string; quantity: number }[];
  } | null;
  if (!body?.customerName?.trim()) {
    return NextResponse.json({ error: "Indique ton nom." }, { status: 400 });
  }
  if (!body.address?.trim()) {
    return NextResponse.json({ error: "Indique où livrer." }, { status: 400 });
  }
  if (!body.arriveAt?.trim()) {
    return NextResponse.json({ error: "Choisis l'heure d'arrivée." }, { status: 400 });
  }
  if (typeof body.amountPaid !== "number" || !Number.isFinite(body.amountPaid)) {
    return NextResponse.json({ error: "Dis combien tu paies maintenant." }, { status: 400 });
  }
  try {
    const order = createOrder({
      customerName: body.customerName,
      phone: body.phone ?? "",
      address: body.address,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
      arriveAt: body.arriveAt,
      amountPaid: body.amountPaid,
      lines: body.lines ?? [],
    });
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Commande impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
