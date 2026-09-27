import fs from "fs/promises";
import path from "path";
import { extractFromAudio } from "../lib/ai";

// Normalisation des chaînes de caractères (minuscules, sans accents)
function normalize(str: string | null | undefined): string | null {
  if (!str) return null;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function runEval() {
  const dataDir = path.join(process.cwd(), "data", "test");
  const expectedPath = path.join(dataDir, "expected.json");
  const phrasesDir = path.join(dataDir, "phrases");

  let expectedData;
  try {
    const fileContent = await fs.readFile(expectedPath, "utf8");
    expectedData = JSON.parse(fileContent);
  } catch {
    console.error(`Erreur : Impossible de lire ${expectedPath}. Assure-toi que les fichiers existent.`);
    return;
  }

  const results = [];
  const totalScore = {
    intent: 0,
    customer_name: 0,
    amount_paid: 0,
    amount_credit: 0,
    items: 0,
    count: 0
  };

  console.log(`Démarrage de l'évaluation sur ${expectedData.length} phrases...\n`);

  for (const item of expectedData) {
    const { file, expected } = item;
    const audioPath = path.join(phrasesDir, file);
    
    let audioBuffer;
    try {
      audioBuffer = await fs.readFile(audioPath);
    } catch {
      console.warn(`⚠️  Fichier ignoré (introuvable) : ${file}`);
      continue;
    }

    const mimeType = file.endsWith(".mp4") ? "video/mp4" : (file.endsWith(".mp3") ? "audio/mp3" : "audio/m4a");

    try {
      const { extraction, provider } = await extractFromAudio(audioBuffer, mimeType);
      
      const intentOk = extraction.intent === expected.intent;
      const customerOk = normalize(extraction.customer_name) === normalize(expected.customer_name);
      const paidOk = extraction.amount_paid === expected.amount_paid;
      const creditOk = extraction.amount_credit === expected.amount_credit;
      
      // Validation des produits
      let itemsOk = true;
      if (expected.items && expected.items.length > 0) {
        if (!extraction.items || extraction.items.length !== expected.items.length) {
          itemsOk = false;
        } else {
          for (let i = 0; i < expected.items.length; i++) {
            const expItem = expected.items[i];
            const extItem = extraction.items.find((it: { product: string, quantity: number }) => normalize(it.product) === normalize(expItem.product));
            if (!extItem || extItem.quantity !== expItem.quantity) {
              itemsOk = false;
              break;
            }
          }
        }
      } else {
        itemsOk = (!extraction.items || extraction.items.length === 0);
      }

      results.push({
        Fichier: file,
        Provider: provider,
        Intention: intentOk ? "✅" : "❌",
        Client: customerOk ? "✅" : "❌",
        Payé: paidOk ? "✅" : "❌",
        Crédit: creditOk ? "✅" : "❌",
        Produits: itemsOk ? "✅" : "❌"
      });

      totalScore.count++;
      if (intentOk) totalScore.intent++;
      if (customerOk) totalScore.customer_name++;
      if (paidOk) totalScore.amount_paid++;
      if (creditOk) totalScore.amount_credit++;
      if (itemsOk) totalScore.items++;

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`❌ Erreur sur ${file} :`, msg);
    }
  }

  if (results.length > 0) {
    console.table(results);

    console.log("\n📊 --- SCORES GLOBAUX ---");
    console.log(`Intention : ${((totalScore.intent / totalScore.count) * 100).toFixed(0)}%`);
    console.log(`Client    : ${((totalScore.customer_name / totalScore.count) * 100).toFixed(0)}%`);
    console.log(`Payé      : ${((totalScore.amount_paid / totalScore.count) * 100).toFixed(0)}%`);
    console.log(`Crédit    : ${((totalScore.amount_credit / totalScore.count) * 100).toFixed(0)}%`);
    console.log(`Produits  : ${((totalScore.items / totalScore.count) * 100).toFixed(0)}%`);
  } else {
    console.log("Aucune phrase évaluée.");
  }
}

runEval();
