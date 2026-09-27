import { NextResponse } from "next/server";
import { computeInsights } from "@/lib/insights";
import { getState, seedSource } from "@/lib/store";

export const runtime = "nodejs";

/** GET /api/insights → panneau « Ton business », calculé à partir de la Karna. */
export async function GET() {
  const insights = computeInsights(getState());
  return NextResponse.json({ ...insights, dataSource: seedSource() });
}
