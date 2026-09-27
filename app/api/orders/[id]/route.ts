import { NextResponse } from "next/server";
import { acceptOrder, refuseOrder } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/orders/:id → le hanout accepte (note sur la Karna) ou refuse. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  try {
    if (body?.action === "accept") return NextResponse.json(acceptOrder(id));
    if (body?.action === "refuse") return NextResponse.json({ order: refuseOrder(id) });
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Commande introuvable.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
