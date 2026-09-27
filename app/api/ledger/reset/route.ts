import { NextResponse } from "next/server";
import { resetState } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/ledger/reset → efface les clients et les ventes, garde le catalogue. */
export async function POST() {
  return NextResponse.json(resetState());
}
