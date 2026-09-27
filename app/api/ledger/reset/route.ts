import { NextResponse } from "next/server";
import { resetState } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/ledger/reset → remet la Karna à l'état du seed (utile avant la démo). */
export async function POST() {
  return NextResponse.json(resetState());
}
