import { extractFromText } from "../lib/ai";

async function run() {
  const text = "Karim khda tlata kilo dial sokkar, khallas mia w baqi lih miatayn";
  console.log(`Test d'extraction sur le texte : "${text}"\n`);
  
  try {
    const result = await extractFromText(text);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Erreur détaillée :", e);
  }
}

run();
