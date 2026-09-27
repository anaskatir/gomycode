import { NextResponse } from "next/server";
import { getState } from "@/lib/store";

export const runtime = "nodejs";

/** GET /api/catalog → nom du hanout et prix, sans la Karna des clients. */
export async function GET() {
  const state = getState();
  return NextResponse.json({ shop: state.shop, products: state.products });
}
