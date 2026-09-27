// Adaptateur entre les routes API et l'IA.
//
// - Une clé GEMINI_API_KEY ou GROQ_API_KEY est présente → vraie IA (lib/ai.ts, personne 1).
// - Aucune clé → mode démo : réponses préparées, badge « Exemple de secours ».
// Le contrat (Extraction + provider) est dans lib/types.ts.

import * as ai from "./ai";
import { SAMPLE_PHRASES } from "./samples";
import type { Extraction, Provider } from "./types";

export type ExtractResult = { extraction: Extraction; provider: Provider };

function hasAiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

export async function extractFromText(text: string): Promise<ExtractResult> {
  if (hasAiKey()) return ai.extractFromText(text);
  return { extraction: pickCanned(text), provider: "mock" };
}

export async function extractFromAudio(audio: Buffer, mimeType: string): Promise<ExtractResult> {
  if (hasAiKey()) return ai.extractFromAudio(audio, mimeType);
  const e = pickCanned(SAMPLE_PHRASES[0].text);
  return {
    extraction: {
      ...e,
      uncertainties: ["Mode démo : l'audio n'a pas été analysé, aucune clé IA n'est configurée."],
    },
    provider: "mock",
  };
}

// ---- Mode démo -----------------------------------------------------------------

const CANNED: Record<string, Extraction> = {
  karim: {
    transcript: "Karim khda tlata kilo dial sokkar, khallas mia w baqi lih miatayn",
    intent: "sale",
    customer_name: "Karim",
    items: [{ product: "sucre", quantity: 3, unit: "kg", price: null }],
    amount_total: 300,
    amount_paid: 100,
    amount_credit: 200,
    confidence: 0.88,
    uncertainties: [],
  },
  fatima: {
    transcript: "Fatima jat khallsat khamsin derham",
    intent: "payment",
    customer_name: "Fatima",
    items: [],
    amount_total: 50,
    amount_paid: 50,
    amount_credit: 0,
    confidence: 0.92,
    uncertainties: [],
  },
  rachid: {
    transcript: "Rachid khda jouj litro dial zit w khobz, khallas kolchi",
    intent: "sale",
    customer_name: "Rachid",
    items: [
      { product: "huile", quantity: 2, unit: "L", price: null },
      { product: "pain", quantity: null, unit: null, price: null },
    ],
    amount_total: null,
    amount_paid: null,
    amount_credit: 0,
    confidence: 0.74,
    uncertainties: ["Quantité de pain non précisée, 1 supposé.", "Montant total non dit : calculé à partir des prix du hanout."],
  },
  youssef: {
    transcript: "Youssef khda l7lib w danone, khallas mya ryal, baqi lih 3echrin derham",
    intent: "sale",
    customer_name: "Youssef",
    items: [
      { product: "lait", quantity: 1, unit: "L", price: null },
      { product: "yaourt", quantity: 1, unit: "pcs", price: null },
    ],
    amount_total: 25,
    amount_paid: 5,
    amount_credit: 20,
    confidence: 0.61,
    uncertainties: ["« mya ryal » converti en 5 dh (20 ryal = 1 dh). À confirmer avec l'épicier."],
  },
  khadija: {
    transcript: "Khadija khdat atay, kredi",
    intent: "sale",
    customer_name: "Khadija",
    items: [{ product: "thé", quantity: null, unit: null, price: null }],
    amount_total: null,
    amount_paid: 0,
    amount_credit: null,
    confidence: 0.55,
    uncertainties: ["Quantité de thé non précisée.", "Montant non dit : 1 paquet au prix du hanout supposé."],
  },
};

function pickCanned(text: string): Extraction {
  const t = text.toLowerCase();
  for (const key of Object.keys(CANNED)) {
    if (t.includes(key)) return { ...CANNED[key], transcript: text };
  }
  return {
    transcript: text,
    intent: "unknown",
    customer_name: null,
    items: [],
    amount_total: null,
    amount_paid: null,
    amount_credit: null,
    confidence: 0.3,
    uncertainties: ["Mode démo : phrase non reconnue. Configure une clé IA dans .env.local pour l'analyse réelle."],
  };
}
