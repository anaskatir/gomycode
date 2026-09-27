// Karna persistée dans SQLite (data/soukvoice.db).
// Le catalogue produits vient de data/seed.json. Les clients d'exemple ne sont pas chargés :
// seuls les noms enregistrés au micro ou au clavier restent affichés.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalize } from "./matchCustomer";
import { buildMockSeed } from "./mockSeed";
import { pointsForPurchase } from "./points";
import type { Customer, LedgerState, Product, RemoteOrder, Transaction, TransactionItem } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
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
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  dropExampleCustomers(db);
  const n = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
  ensureProductColumns(db);
  if (n.n === 0) importSeed(loadSeed());
  syncCatalog(db);
  ensureOrderColumns(db);
  return db;
}

function ensureOrderColumns(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("address")) database.exec("ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT ''");
  if (!names.has("lat")) database.exec("ALTER TABLE orders ADD COLUMN lat REAL");
  if (!names.has("lng")) database.exec("ALTER TABLE orders ADD COLUMN lng REAL");
  if (!names.has("arrive_at")) database.exec("ALTER TABLE orders ADD COLUMN arrive_at TEXT NOT NULL DEFAULT ''");
  if (!names.has("amount_paid")) database.exec("ALTER TABLE orders ADD COLUMN amount_paid REAL");
  if (!names.has("amount_credit")) database.exec("ALTER TABLE orders ADD COLUMN amount_credit REAL");
}

function ensureProductColumns(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("stock")) database.exec("ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0");
}

/** Les clients du fichier d'exemple (Rachid, Karim, Fatima…) ne restent pas dans l'app. */
function dropExampleCustomers(database: DatabaseSync) {
  const seeded = database.prepare("SELECT COUNT(*) AS n FROM transactions WHERE source = 'seed'").get() as { n: number };
  const own = database.prepare("SELECT COUNT(*) AS n FROM transactions WHERE source != 'seed'").get() as { n: number };
  if (seeded.n > 0 && own.n === 0) {
    database.exec("DELETE FROM transactions; DELETE FROM customers;");
  }
}

function readCatalog(): Product[] {
  if (fs.existsSync(CATALOG_FILE)) {
    return JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) as Product[];
  }
  const raw = fs.existsSync(SEED_FILE)
    ? (JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as LedgerState)
    : buildMockSeed();
  return raw.products;
}

function syncCatalog(database: DatabaseSync) {
  const products = readCatalog();
  database.exec("BEGIN");
  database.exec("DELETE FROM products;");
  const insert = database.prepare(
    "INSERT INTO products (id, name_darija, name_fr, unit, price, stock) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const p of products) insert.run(p.id, p.name_darija, p.name_fr, p.unit, p.price, p.stock ?? 0);
  database.exec("COMMIT");
}

function loadSeed(): LedgerState {
  const raw = fs.existsSync(SEED_FILE)
    ? (JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as LedgerState)
    : buildMockSeed();
  return {
    shop: raw.shop,
    products: readCatalog(),
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
    "INSERT INTO products (id, name_darija, name_fr, unit, price, stock) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const p of state.products) insertProduct.run(p.id, p.name_darija, p.name_fr, p.unit, p.price, p.stock ?? 0);
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
    .prepare("SELECT id, name_darija, name_fr, unit, price, stock FROM products")
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
  const database = open();
  cache = null;
  importSeed(loadSeed());
  database.exec("DELETE FROM orders;");
  cache = readState();
  return cache;
}

function readOrder(row: {
  id: string;
  customer_name: string;
  phone: string;
  items_json: string;
  total: number;
  status: RemoteOrder["status"];
  created_at: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  arrive_at: string | null;
  amount_paid: number | null;
  amount_credit: number | null;
}): RemoteOrder {
  const paid = row.amount_paid ?? 0;
  const credit = row.amount_credit ?? Math.round((row.total - paid) * 100) / 100;
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    items: JSON.parse(row.items_json) as TransactionItem[],
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
    location: {
      address: row.address ?? "",
      lat: row.lat,
      lng: row.lng,
    },
    arriveAt: row.arrive_at ?? "",
    amountPaid: paid,
    amountCredit: credit,
  };
}

export function listOrders(): RemoteOrder[] {
  const rows = open()
    .prepare(
      `SELECT id, customer_name, phone, items_json, total, status, created_at, address, lat, lng, arrive_at, amount_paid, amount_credit
       FROM orders ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    customer_name: string;
    phone: string;
    items_json: string;
    total: number;
    status: RemoteOrder["status"];
    created_at: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    arrive_at: string | null;
    amount_paid: number | null;
    amount_credit: number | null;
  }>;
  return rows.map(readOrder);
}

export function createOrder(input: {
  customerName: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  arriveAt: string;
  amountPaid: number;
  lines: { productId: string; quantity: number }[];
}): RemoteOrder {
  const name = input.customerName.trim();
  const address = input.address.trim();
  const arriveAt = input.arriveAt.trim();
  if (!name) throw new Error("Le nom est obligatoire.");
  if (!address) throw new Error("L'adresse est obligatoire.");
  if (!/^\d{2}:\d{2}$/.test(arriveAt)) throw new Error("Choisis l'heure d'arrivée.");
  if (!Number.isFinite(input.amountPaid) || input.amountPaid < 0) {
    throw new Error("Dis combien tu paies maintenant.");
  }
  const state = getState();
  const items: TransactionItem[] = [];
  for (const line of input.lines) {
    const qty = Math.floor(line.quantity);
    if (qty <= 0) continue;
    const product = state.products.find((p) => p.id === line.productId);
    if (!product) continue;
    items.push({ product: product.name_fr, quantity: qty, unit: product.unit, price: product.price });
  }
  if (items.length === 0) throw new Error("Le panier est vide.");
  const total = Math.round(items.reduce((s, it) => s + it.quantity * it.price, 0) * 100) / 100;
  const amountPaid = Math.round(input.amountPaid * 100) / 100;
  if (amountPaid > total) throw new Error("Tu ne peux pas payer plus que le total.");
  const amountCredit = Math.round((total - amountPaid) * 100) / 100;
  const order: RemoteOrder = {
    id: `o${Date.now()}`,
    customerName: name,
    phone: input.phone.trim(),
    items,
    total,
    status: "pending",
    createdAt: new Date().toISOString(),
    location: { address, lat: input.lat, lng: input.lng },
    arriveAt,
    amountPaid,
    amountCredit,
  };
  open()
    .prepare(
      `INSERT INTO orders (id, customer_name, phone, items_json, total, status, created_at, address, lat, lng, arrive_at, amount_paid, amount_credit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      order.id,
      order.customerName,
      order.phone,
      JSON.stringify(order.items),
      order.total,
      order.status,
      order.createdAt,
      address,
      input.lat,
      input.lng,
      arriveAt,
      amountPaid,
      amountCredit,
    );
  return order;
}

export function refuseOrder(id: string): RemoteOrder {
  const order = listOrders().find((o) => o.id === id);
  if (!order || order.status !== "pending") throw new Error("Commande introuvable.");
  open().prepare("UPDATE orders SET status = 'refused' WHERE id = ?").run(id);
  return { ...order, status: "refused" };
}

/** Une commande à distance devient une vente à crédit, avec les points. */
export function acceptOrder(id: string): { order: RemoteOrder; customer: Customer } {
  const order = listOrders().find((o) => o.id === id);
  if (!order || order.status !== "pending") throw new Error("Commande introuvable.");

  const state = getState();
  const key = normalize(order.customerName);
  let customer = state.customers.find((c) => normalize(c.name) === key) ?? null;
  if (!customer) {
    customer = {
      id: `c${state.customers.length + 1}`,
      name: order.customerName,
      phone: order.phone || `2126000000${String(state.customers.length + 1).padStart(2, "0")}`,
      balance: 0,
      points: 0,
    };
    state.customers.push(customer);
  }

  const pointsEarned = pointsForPurchase(order.total);
  customer.balance = Math.round((customer.balance + order.amountCredit) * 100) / 100;
  customer.points = (customer.points ?? 0) + pointsEarned;
  const transaction: Transaction = {
    id: `t${state.transactions.length + 1}`,
    customerId: customer.id,
    intent: "sale",
    items: order.items,
    amount_total: order.total,
    amount_paid: order.amountPaid,
    amount_credit: order.amountCredit,
    createdAt: new Date().toISOString(),
    source: "remote",
    transcript: [
      "Commande sans venir",
      order.location.address,
      order.arriveAt ? `arrivée ${order.arriveAt}` : "",
      `payé ${order.amountPaid} dh`,
      `dette ${order.amountCredit} dh`,
    ]
      .filter(Boolean)
      .join(" · "),
    pointsEarned,
  };
  state.transactions.push(transaction);
  saveState(state);
  open().prepare("UPDATE orders SET status = 'accepted' WHERE id = ?").run(id);
  return { order: { ...order, status: "accepted" }, customer };
}

function soldQuantity(state: LedgerState, product: Product): number {
  const key = product.name_fr.trim().toLowerCase();
  let sold = 0;
  for (const tx of state.transactions) {
    if (tx.intent !== "sale") continue;
    for (const item of tx.items) {
      if (item.product.trim().toLowerCase() === key) sold += item.quantity;
    }
  }
  return sold;
}

function writeCatalog(products: Product[]) {
  const lines = products.map((p) => {
    const compact = JSON.stringify({
      id: p.id,
      name_darija: p.name_darija,
      name_fr: p.name_fr,
      unit: p.unit,
      price: p.price,
      stock: p.stock ?? 0,
    });
    const spaced = compact
      .split('{"').join('{ "')
      .split('"}').join('" }')
      .split('":').join('": ')
      .split(',"').join(', "');
    return `  ${spaced}`;
  });
  fs.writeFileSync(CATALOG_FILE, `[\n${lines.join(",\n")}\n]\n`);
}

/** price = prix du rayon. stock = ce qu'il reste en rayon, pas le stock d'ouverture. */
export function updateProduct(id: string, fields: { price?: number; stock?: number }): LedgerState {
  const state = getState();
  const product = state.products.find((p) => p.id === id);
  if (!product) throw new Error("Produit introuvable.");
  if (fields.price !== undefined) {
    if (!Number.isFinite(fields.price) || fields.price < 0) throw new Error("Prix invalide.");
    product.price = Math.round(fields.price * 100) / 100;
  }
  if (fields.stock !== undefined) {
    if (!Number.isFinite(fields.stock) || fields.stock < 0) throw new Error("Stock invalide.");
    const opening = fields.stock + soldQuantity(state, product);
    product.stock = Math.round(opening * 100) / 100;
  }
  open().prepare("UPDATE products SET price = ?, stock = ? WHERE id = ?").run(product.price, product.stock ?? 0, id);
  writeCatalog(state.products);
  cache = state;
  return state;
}

/** Retire le client de la Karna. Les ventes restent dans le chiffre, sans son nom. */
export function deleteCustomer(id: string): LedgerState {
  const state = getState();
  const customer = state.customers.find((c) => c.id === id);
  if (!customer) throw new Error("Client introuvable.");
  state.customers = state.customers.filter((c) => c.id !== id);
  for (const tx of state.transactions) {
    if (tx.customerId === id) tx.customerId = null;
  }
  const database = open();
  database.prepare("DELETE FROM customers WHERE id = ?").run(id);
  database.prepare("UPDATE transactions SET customer_id = NULL WHERE customer_id = ?").run(id);
  cache = state;
  return state;
}
