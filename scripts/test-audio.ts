import { extractFromAudio } from "../lib/ai";
import fs from "fs/promises";
import path from "path";

async function run() {
  const filePath = path.join(process.cwd(), "..", "karim.mp4");
  
  try {
    console.log(`Lecture du fichier ${filePath}...`);
    const buffer = await fs.readFile(filePath);
    
    console.log("Envoi de l'audio à Gemini...");
    const result = await extractFromAudio(buffer, "audio/mp4");
    
    console.log("\nRésultat :");
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.error(`\nErreur : Le fichier ${filePath} n'existe pas.`);
      console.error("Mets un fichier audio en darija nommé 'test.m4a' à la racine du projet (gomycode) pour tester !");
    } else {
      console.error("\nErreur détaillée :", e);
    }
  }
}

run();
