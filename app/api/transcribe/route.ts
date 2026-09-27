import { NextResponse } from "next/server";
import { extractFromAudio, extractFromText } from "@/lib/extract";
import { matchCustomer } from "@/lib/matchCustomer";
import { getState } from "@/lib/store";
import type { TranscribeResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/transcribe
 * - multipart/form-data avec un champ `audio` (Blob)  → analyse vocale
 * - application/json { text: string }                 → analyse d'un texte tapé
 * Ne modifie PAS la Karna : l'écran confirme ensuite via POST /api/ledger.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let result;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio");
      if (!(audio instanceof Blob) || audio.size === 0) {
        return NextResponse.json({ error: "Aucun audio reçu." }, { status: 400 });
      }
      const buffer = Buffer.from(await audio.arrayBuffer());
      result = await extractFromAudio(buffer, audio.type || "audio/webm");
    } else {
      const body = (await req.json().catch(() => null)) as { text?: string } | null;
      if (!body?.text?.trim()) {
        return NextResponse.json({ error: "Aucun texte reçu." }, { status: 400 });
      }
      result = await extractFromText(body.text.trim());
    }

    const match = matchCustomer(result.extraction.customer_name, getState().customers);
    const payload: TranscribeResponse = { ...result, match };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
