import { extractionSchema, type Extraction } from "./schema";
import { systemPrompt } from "./prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

type GeminiInput = 
  | { type: "text"; text: string }
  | { type: "audio"; buffer: Buffer; mimeType: string };

async function callGemini(input: GeminiInput, errorFeedback?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const parts: any[] = [];

  if (input.type === "audio") {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.buffer.toString("base64")
      }
    });
    const promptText = errorFeedback
      ? `Attention, ta précédente réponse était invalide : ${errorFeedback}. Ré-écoute l'audio et renvoie un JSON valide.`
      : `Écoute cet audio et extrais les informations de la transaction en JSON.`;
    parts.push({ text: promptText });
  } else {
    const promptText = errorFeedback 
      ? `Voici la phrase : "${input.text}"\n\nAttention, ta précédente réponse était invalide : ${errorFeedback}. Corrige-la et renvoie un JSON valide.`
      : `Voici la phrase : "${input.text}"`;
    parts.push({ text: promptText });
  }

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
          parts: parts
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

async function callGroqTranscription(buffer: Buffer, mimeType: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  const ext = mimeType.split('/')[1] || "m4a";
  formData.append("file", blob, `audio.${ext}`);
  formData.append("model", "whisper-large-v3");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    // Le FormData natif dans Node set automatiquement le Content-Type avec le boundary
    body: formData as any
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Transcription error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.text;
}

async function callGroqLlama(text: string, errorFeedback?: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

  const promptText = errorFeedback
    ? `Voici la phrase transcrite : "${text}"\n\nAttention, ta précédente réponse était invalide : ${errorFeedback}. Corrige-la et renvoie un JSON valide.`
    : `Voici la phrase transcrite : "${text}"`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Llama error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) throw new Error("Invalid response structure from Groq");
  
  return content;
}

async function fallbackGroq(input: GeminiInput): Promise<{ extraction: Extraction; provider: "groq" }> {
  let textToExtract = "";
  if (input.type === "audio") {
    textToExtract = await callGroqTranscription(input.buffer, input.mimeType);
  } else {
    textToExtract = input.text;
  }

  try {
    const rawResponse = await callGroqLlama(textToExtract);
    const json = JSON.parse(rawResponse);
    return { extraction: extractionSchema.parse(json), provider: "groq" };
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const retryResponse = await callGroqLlama(textToExtract, errorMessage);
    const json = JSON.parse(retryResponse);
    return { extraction: extractionSchema.parse(json), provider: "groq" };
  }
}

export async function extractFromText(text: string): Promise<{ extraction: Extraction; provider: "gemini" | "groq" }> {
  try {
    const rawResponse = await callGemini({ type: "text", text });
    try {
      const json = JSON.parse(rawResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const retryResponse = await callGemini({ type: "text", text }, errorMessage);
      const json = JSON.parse(retryResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    }
  } catch (error) {
    console.warn("Gemini a échoué (ou json invalide 2 fois), bascule sur Groq...", error instanceof Error ? error.message : error);
    return fallbackGroq({ type: "text", text });
  }
}

export async function extractFromAudio(audio: Buffer, mimeType: string): Promise<{ extraction: Extraction; provider: "gemini" | "groq" }> {
  try {
    const rawResponse = await callGemini({ type: "audio", buffer: audio, mimeType });
    try {
      const json = JSON.parse(rawResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const retryResponse = await callGemini({ type: "audio", buffer: audio, mimeType }, errorMessage);
      const json = JSON.parse(retryResponse);
      const extraction = extractionSchema.parse(json);
      return { extraction, provider: "gemini" };
    }
  } catch (error) {
    console.warn("Gemini a échoué (ou json invalide 2 fois), bascule sur Groq...", error instanceof Error ? error.message : error);
    return fallbackGroq({ type: "audio", buffer: audio, mimeType });
  }
}
