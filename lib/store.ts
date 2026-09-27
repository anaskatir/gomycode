// Karna persistée dans SQLite (data/soukvoice.db).
// Le catalogue produits vient de data/seed.json. Les clients d'exemple ne sont pas chargés :
// seuls les noms enregistrés au micro ou au clavier restent affichés.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildMockSeed } from "./mockSeed";
import type { Customer, LedgerState, Product, Transaction } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const DB_FILE = path.join(DATA_DIR, "soukvoice.db");

let db: DatabaseSync | null = null;
let cache: LedgerState | null = null;

function open(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, city TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      balance REAL NOT NULL,
      points INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name_darija TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      unit TEXT NOT NULL,
      price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      intent TEXT NOT NULL,
      items_json TEXT NOT NULL,
      amount_total REAL NOT NULL,
      amount_paid REAL NOT NULL,
      amount_credit REAL NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      transcript TEXT,
      confidence REAL,
      points_earned INTEGER NOT NULL DEFAULT 0
    );
  `);
  dropExampleCustomers(db);
  const n = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
  if (n.n === 0) importSeed(loadSeed());
  return db;
}

/** Les clients du fichier d'exemple (Rachid, Karim, Fatima…) ne restent pas dans l'app. */
function dropExampleCustomers(database: DatabaseSync) {
  const seeded = database.prepare("SELECT COUNT(*) AS n FROM transactions WHERE source = 'seed'").get() as { n: number };
  const own = database.prepare("SELECT COUNT(*) AS n FROM transactions WHERE source != 'seed'").get() as { n: number };
  if (seeded.n > 0 && own.n === 0) {
    database.exec("DELETE FROM transactions; DELETE FROM customers;");
  }
}

function loadSeed(): LedgerState {
  const raw = fs.existsSync(SEED_FILE)
    ? (JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as LedgerState)
    : buildMockSeed();
  return {
    shop: raw.shop,
    products: raw.products,
    customers: [],
    transactions: [],
  };
}

function importSeed(state: LedgerState) {
  const database = open();
  database.exec("BEGIN");
  database.exec("DELETE FROM transactions; DELETE FROM products; DELETE FROM customers; DELETE FROM shop;");
  database.prepare("INSERT INTO shop (id, name, city) VALUES (1, ?, ?)").run(state.shop.name, state.shop.city);
  const insertCustomer = database.prepare(
    "INSERT INTO customers (id, name, phone, balance, points) VALUES (?, ?, ?, ?, ?)",
  );
  for (const c of state.customers) insertCustomer.run(c.id, c.name, c.phone, c.balance, c.points ?? 0);
  const insertProduct = database.prepare(
    "INSERT INTO products (id, name_darija, name_fr, unit, price) VALUES (?, ?, ?, ?, ?)",
  );
  for (const p of state.products) insertProduct.run(p.id, p.name_darija, p.name_fr, p.unit, p.price);
  const insertTx = database.prepare(
    `INSERT INTO transactions
      (id, customer_id, intent, items_json, amount_total, amount_paid, amount_credit, created_at, source, transcript, confidence, points_earned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const tx of state.transactions) {
    insertTx.run(
      tx.id,
      tx.customerId,
      tx.intent,
      JSON.stringify(tx.items),
      tx.amount_total,
      tx.amount_paid,
      tx.amount_credit,
      tx.createdAt,
      tx.source,
      tx.transcript ?? null,
      tx.confidence ?? null,
      tx.pointsEarned ?? 0,
    );
  }
  database.exec("COMMIT");
}

function readState(): LedgerState {
  const database = open();
  const shop = database.prepare("SELECT name, city FROM shop WHERE id = 1").get() as { name: string; city: string };
  const customers = database
    .prepare("SELECT id, name, phone, balance, points FROM customers")
    .all() as Customer[];
  const products = database
    .prepare("SELECT id, name_darija, name_fr, unit, price FROM products")
    .all() as Product[];
  const rows = database
    .prepare(
      `SELECT id, customer_id, intent, items_json, amount_total, amount_paid, amount_credit,
              created_at, source, transcript, confidence, points_earned
       FROM transactions ORDER BY created_at`,
    )
    .all() as Array<{
    id: string;
    customer_id: string | null;
    intent: Transaction["intent"];
    items_json: string;
    amount_total: number;
    amount_paid: number;
    amount_credit: number;
    created_at: string;
    source: Transaction["source"];
    transcript: string | null;
    confidence: number | null;
    points_earned: number;
  }>;

  return {
    shop: shop ?? { name: "Hanout Si Mohamed", city: "Casablanca" },
    customers,
    products,
    transactions: rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      intent: row.intent,
      items: JSON.parse(row.items_json) as Transaction["items"],
      amount_total: row.amount_total,
      amount_paid: row.amount_paid,
      amount_credit: row.amount_credit,
      createdAt: row.created_at,
      source: row.source,
      transcript: row.transcript ?? undefined,
      confidence: row.confidence ?? undefined,
      pointsEarned: row.points_earned,
    })),
  };
}

export function seedSource(): "sqlite" | "seed.json" | "mock" {
  open();
  if (fs.existsSync(DB_FILE)) return "sqlite";
  return fs.existsSync(SEED_FILE) ? "seed.json" : "mock";
}

export function getState(): LedgerState {
  if (!cache) cache = readState();
  return cache;
}

export function saveState(state: LedgerState): void {
  cache = state;
  importSeed(state);
}

export function resetState(): LedgerState {
  open();
  cache = null;
  importSeed(loadSeed());
  cache = readState();
  return cache;
}
