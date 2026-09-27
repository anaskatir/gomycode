import fs from 'node:fs';
import path from 'node:path';

const testDir = path.join(process.cwd(), 'data', 'test');
const expectedPath = path.join(testDir, 'expected.json');

console.log("🔍 Validation des données du projet en cours...\n");

// 1. Vérification du fichier expected.json
if (!fs.existsSync(expectedPath)) {
  console.error("❌ ERREUR: data/test/expected.json est introuvable !");
  process.exit(1);
}

let expectedData;
try {
  expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
} catch {
  console.error("❌ ERREUR: expected.json contient une erreur de syntaxe JSON.");
  process.exit(1);
}

if (!Array.isArray(expectedData) || expectedData.length !== 20) {
  console.error(`❌ ERREUR: expected.json doit contenir exactement 20 entrées (actuellement: ${expectedData.length}).`);
  process.exit(1);
}

// 2. Vérification de la présence des 20 fichiers audio .m4a
let missingAudios = 0;
expectedData.forEach(item => {
  const audioPath = path.join(testDir, item.file);
  if (!fs.existsSync(audioPath)) {
    console.error(`⚠️ Fichier audio manquant: ${item.file}`);
    missingAudios++;
  }
});

if (missingAudios > 0) {
  console.error(`\n❌ ÉCHEC DE LA VALIDATION: ${missingAudios} fichier(s) audio manquant(s).`);
  process.exit(1);
}

// 3. Vérification du fichier seed.json
const seedPath = path.join(process.cwd(), 'data', 'seed.json');
if (!fs.existsSync(seedPath)) {
  console.warn("⚠️ ATTENTION: data/seed.json n'a pas encore été généré (lance 'npm run seed').");
} else {
  console.log("✅ data/seed.json est présent.");
}

console.log("\n✅ VALIDATION RÉUSSIE: Le dataset de test (20 audios + JSON) est 100% conforme !");