import { extractionSchema, type Extraction } from "./schema";
import { systemPrompt } from "./prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(text: string, errorFeedback?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const promptText = errorFeedback 
    ? `Voici la phrase : "${text}"\n\nAttention, ta précédente réponse était invalide : ${errorFeedback}. Corrige-la et renvoie un JSON valide.`
    : `Voici la phrase : "${text}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    throw new Error("Invalid response structure from Gemini");
  }

  return content;
}

export async function extractFromText(text: string): Promise<{ extraction: Extraction; provider: "gemini" | "groq" }> {
  try {
    // Premier essai avec Gemini
    const rawResponse = await callGemini(text);
    try {
      const json = JSON.parse(rawResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    } catch (e: any) {
      // Deuxième essai en cas d'erreur de validation (Zod ou JSON parse)
      const errorMessage = e instanceof Error ? e.message : String(e);
      const retryResponse = await callGemini(text, errorMessage);
      const json = JSON.parse(retryResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    }
  } catch (error) {
    // Si Gemini échoue (réseau, 2ème erreur de parsing, etc.), bascule sur Groq (Étape 5)
    // Pour le moment (Étape 3), on remonte l'erreur car Groq n'est pas encore implémenté.
    throw error;
  }
}
