// Données de secours pour l'écran, utilisées seulement si data/seed.json n'existe pas encore.
// La personne 3 livre le vrai seed.json avec la même structure ; ce fichier n'est alors plus lu.
// Tout est inventé : noms, numéros (212600000xxx n'existent pas), dettes.

import type { Customer, LedgerState, Product, Transaction } from "./types";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMER_NAMES = [
  "Karim Bakkal",
  "Karim Tahiri",
  "Fatima",
  "Rachid",
  "Khadija",
  "Youssef",
  "Hassan",
  "Naima",
  "Said",
  "Samira",
  "Omar",
  "Zineb",
];

// [darija, français, unité, prix, poids de vente (0 = plus vendu depuis 12 jours)]
const PRODUCTS: [string, string, string, number, number][] = [
  ["sokkar", "sucre", "kg", 12, 10],
  ["zit", "huile", "L", 18, 9],
  ["l7lib", "lait", "L", 8, 10],
  ["khobz", "pain", "pcs", 1.5, 10],
  ["atay", "thé", "paquet", 25, 4],
  ["dqiq", "farine", "kg", 7, 5],
  ["bid", "œufs", "pcs", 1.5, 7],
  ["lma", "eau", "bouteille", 5, 6],
  ["koka", "coca", "bouteille", 7, 5],
  ["danone", "yaourt", "pcs", 3, 6],
  ["bota dial gaz", "bouteille de gaz", "bouteille", 45, 2],
  ["sabon", "savon", "pcs", 6, 1],
  ["qahwa", "café", "paquet", 30, 0],
  ["mel7a", "sel", "kg", 4, 2],
  ["ruz", "riz", "kg", 14, 1],
  ["makarona", "pâtes", "paquet", 6, 0],
];

export function buildMockSeed(now = new Date()): LedgerState {
  const rand = rng(20260927);
  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => ({
    id: `c${i + 1}`,
    name,
    phone: `2126000000${String(i + 1).padStart(2, "0")}`,
    balance: 0,
    points: 0,
  }));
  const products: Product[] = PRODUCTS.map(([d, f, unit, price], i) => ({
    id: `p${i + 1}`,
    name_darija: d,
    name_fr: f,
    unit,
    price,
  }));

  const weights = PRODUCTS.map((p) => p[4]);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const deadProducts = products.filter((_, i) => weights[i] === 0);
  const pickProduct = (daysAgo: number): Product => {
    // Les produits à poids 0 (café, pâtes) se vendaient un peu avant, plus rien depuis 12 jours :
    // c'est ce que le panneau « Ton business » doit repérer.
    if (daysAgo > 12 && deadProducts.length && rand() < 0.12) {
      return deadProducts[Math.floor(rand() * deadProducts.length)];
    }
    let r = rand() * totalWeight;
    for (let i = 0; i < products.length; i++) {
      r -= weights[i];
      if (r <= 0) return products[i];
    }
    return products[0];
  };

  const transactions: Transaction[] = [];
  let id = 1;
  for (let daysAgo = 21; daysAgo >= 1; daysAgo--) {
    const count = 15 + Math.floor(rand() * 15);
    for (let k = 0; k < count; k++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(8 + Math.floor(rand() * 13), Math.floor(rand() * 60), 0, 0);
      const customer = customers[Math.floor(rand() * customers.length)];

      // Un remboursement de temps en temps.
      if (rand() < 0.08 && customer.balance > 20) {
        const paid = Math.min(customer.balance, Math.round((20 + rand() * 80) / 10) * 10);
        customer.balance -= paid;
        transactions.push({
          id: `t${id++}`,
          customerId: customer.id,
          intent: "payment",
          items: [],
          amount_total: paid,
          amount_paid: paid,
          amount_credit: 0,
          createdAt: date.toISOString(),
          source: "seed",
        });
        continue;
      }

      const nItems = rand() < 0.6 ? 1 : 2;
      const items = [];
      for (let j = 0; j < nItems; j++) {
        const p = pickProduct(daysAgo);
        const qty = p.unit === "kg" || p.unit === "L" ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 4);
        items.push({ product: p.name_fr, quantity: qty, unit: p.unit, price: p.price });
      }
      const total = Math.round(items.reduce((s, it) => s + it.quantity * it.price, 0) * 2) / 2;
      const onCredit = rand() < 0.4;
      const paid = onCredit ? Math.round((total * rand()) / 5) * 5 : total;
      const credit = Math.max(0, Math.round((total - paid) * 2) / 2);
      customer.balance = Math.round((customer.balance + credit) * 2) / 2;
      transactions.push({
        id: `t${id++}`,
        customerId: customer.id,
        intent: "sale",
        items,
        amount_total: total,
        amount_paid: paid,
        amount_credit: credit,
        createdAt: date.toISOString(),
        source: "seed",
      });
    }
  }

  return { shop: { name: "Hanout Si Mohamed", city: "Casablanca" }, customers, products, transactions };
}
