// Stockage de la Karna : un fichier JSON local, rien d'externe qui puisse tomber pendant la démo.
// data/seed.json (personne 3) est la source ; data/ledger.json est l'état courant, ignoré par git.

import fs from "node:fs";
import path from "node:path";
import type { LedgerState } from "./types";
import { buildMockSeed } from "./mockSeed";

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const LEDGER_FILE = path.join(DATA_DIR, "ledger.json");

let cache: LedgerState | null = null;

function loadSeed(): LedgerState {
  if (fs.existsSync(SEED_FILE)) {
    return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as LedgerState;
  }
  return buildMockSeed();
}

export function seedSource(): "seed.json" | "mock" {
  return fs.existsSync(SEED_FILE) ? "seed.json" : "mock";
}

export function getState(): LedgerState {
  if (cache) return cache;
  if (fs.existsSync(LEDGER_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")) as LedgerState;
      return cache;
    } catch {
      // fichier corrompu : on repart du seed
    }
  }
  cache = loadSeed();
  return cache;
}

export function saveState(state: LedgerState): void {
  cache = state;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(state, null, 2));
  } catch {
    // système de fichiers en lecture seule (ex. Vercel) : on garde l'état en mémoire
  }
}

export function resetState(): LedgerState {
  cache = loadSeed();
  try {
    fs.rmSync(LEDGER_FILE, { force: true });
  } catch {
    // ignore
  }
  return cache;
}
