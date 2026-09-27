import fs from 'node:fs';
import path from 'node:path';

// Générateur pseudo-aléatoire déterministe (Mulberry32)
function createPRNG(seed) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createPRNG(20260927);

function randomInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// 1. Boutique
const shop = {
  name: "Hanout Si Mohamed",
  city: "Casablanca"
};

// 2. Les 12 clients (avec numéros fictifs 2126XXXXXXXX)
const customerNames = [
  "Karim Bakkal", "Karim Tahiri", "Fatima", "Rachid",
  "Khadija", "Youssef", "Hassan", "Naima",
  "Said", "Samira", "Omar", "Zineb"
];

const customers = customerNames.map((name, idx) => ({
  id: `c${idx + 1}`,
  name: name,
  phone: `212600000${(idx + 1).toString().padStart(3, '0')}`,
  balance: 0
}));

// 3. Les 16 produits avec prix en DH
const products = [
  { id: "p1", name_darija: "sokkar", name_fr: "sucre", unit: "kg", price: 12 },
  { id: "p2", name_darija: "zit", name_fr: "huile", unit: "L", price: 18 },
  { id: "p3", name_darija: "l7lib", name_fr: "lait", unit: "L", price: 7 },
  { id: "p4", name_darija: "khobz", name_fr: "pain", unit: "pièce", price: 1.2 },
  { id: "p5", name_darija: "atay", name_fr: "thé", unit: "pack", price: 28 },
  { id: "p6", name_darija: "dqiq", name_fr: "farine", unit: "kg", price: 5 },
  { id: "p7", name_darija: "bid", name_fr: "œufs", unit: "pièce", price: 1.5 },
  { id: "p8", name_darija: "lma", name_fr: "eau", unit: "L", price: 6 },
  { id: "p9", name_darija: "koka", name_fr: "coca", unit: "pièce", price: 6 },
  { id: "p10", name_darija: "danone", name_fr: "yaourt", unit: "pièce", price: 2.5 },
  { id: "p11", name_darija: "bota dial gaz", name_fr: "bouteille de gaz", unit: "pièce", price: 40 },
  { id: "p12", name_darija: "sabon", name_fr: "savon", unit: "pièce", price: 5 },
  { id: "p13", name_darija: "qahwa", name_fr: "café", unit: "pack", price: 25 },
  { id: "p14", name_darija: "mel7a", name_fr: "sel", unit: "pack", price: 1.5 },
  { id: "p15", name_darija: "ruz", name_fr: "riz", unit: "kg", price: 15 },
  { id: "p16", name_darija: "makarona", name_fr: "pâtes", unit: "pack", price: 10 }
];

const dailyProductFr = ["sucre", "huile", "lait", "pain"];
const rareProductFr = ["riz", "savon"];
const inactiveProductFr = ["café", "pâtes"];

const transactions = [];
let txCounter = 1;

// Génération sur 21 jours (06 Sept 2026 -> 26 Sept 2026)
const startDay = 6;
const totalDays = 21;

for (let d = 0; d < totalDays; d++) {
  const currentDayNum = startDay + d;
  const dateStr = `2026-09-${currentDayNum.toString().padStart(2, '0')}`;
  const isInactivePeriod = d >= 9; // Inactif après le 14 septembre (>=12 jours)

  const dailyTxCount = randomInt(15, 30);
  const mandatoryItems = [...dailyProductFr];

  for (let t = 0; t < dailyTxCount; t++) {
    const isMorning = rng() > 0.4;
    const hour = isMorning ? randomInt(8, 11) : randomInt(17, 21);
    const minute = randomInt(0, 59);
    const timeISO = `${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+01:00`;

    const isPaymentOnly = rng() < 0.10 && t > 0;
    const customer = randomChoice(customers);

    if (isPaymentOnly) {
      const paymentAmount = randomChoice([20, 50, 100, 150, 200]);
      transactions.push({
        id: `t${txCounter++}`,
        customerId: customer.id,
        intent: "payment",
        items: [],
        amount_total: paymentAmount,
        amount_paid: paymentAmount,
        amount_credit: 0,
        createdAt: timeISO,
        source: "seed"
      });
      continue;
    }

    const itemCount = randomInt(1, 3);
    const selectedItems = [];

    for (let i = 0; i < itemCount; i++) {
      let prodFr;
      if (mandatoryItems.length > 0 && i === 0) {
        prodFr = mandatoryItems.pop();
      } else {
        const validProds = products.filter(p => {
          if (inactiveProductFr.includes(p.name_fr) && isInactivePeriod) return false;
          if (rareProductFr.includes(p.name_fr) && rng() > 0.08) return false;
          return true;
        });
        prodFr = randomChoice(validProds).name_fr;
      }

      const prodObj = products.find(p => p.name_fr === prodFr);
      const qty = prodObj.unit === "pièce" || prodObj.unit === "pack" ? randomInt(1, 3) : randomInt(1, 2);

      selectedItems.push({
        product: prodObj.name_fr,
        quantity: qty,
        unit: prodObj.unit,
        price: prodObj.price
      });
    }

    let totalAmount = selectedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    const isCreditSale = rng() < 0.40;
    let paidAmount = totalAmount;
    let creditAmount = 0;

    if (isCreditSale) {
      paidAmount = Math.floor(rng() * (totalAmount / 10)) * 10;
      creditAmount = totalAmount - paidAmount;
    }

    // Crédits anciens élevés pour 3 clients spécifiques
    if (d < 7 && ["c1", "c4", "c5"].includes(customer.id) && rng() < 0.5) {
      creditAmount += 60;
      totalAmount += 60;
    }

    transactions.push({
      id: `t${txCounter++}`,
      customerId: customer.id,
      intent: "sale",
      items: selectedItems,
      amount_total: Number(totalAmount.toFixed(2)),
      amount_paid: Number(paidAmount.toFixed(2)),
      amount_credit: Number(creditAmount.toFixed(2)),
      createdAt: timeISO,
      source: "seed"
    });
  }
}

// Calcul et mise à jour des soldes exacts
customers.forEach(cust => {
  const custTxs = transactions.filter(t => t.customerId === cust.id);
  const totalCreditAdded = custTxs
    .filter(t => t.intent === "sale")
    .reduce((sum, t) => sum + t.amount_credit, 0);
  
  const totalPaid = custTxs
    .filter(t => t.intent === "payment")
    .reduce((sum, t) => sum + t.amount_paid, 0);

  cust.balance = Number((totalCreditAdded - totalPaid).toFixed(2));
});

// Vérification stricte
customers.forEach(cust => {
  const checkSalesCredit = transactions
    .filter(t => t.customerId === cust.id && t.intent === "sale")
    .reduce((sum, t) => sum + t.amount_credit, 0);
  const checkPayments = transactions
    .filter(t => t.customerId === cust.id && t.intent === "payment")
    .reduce((sum, t) => sum + t.amount_paid, 0);
  const expectedBalance = Number((checkSalesCredit - checkPayments).toFixed(2));

  if (cust.balance !== expectedBalance) {
    throw new Error(`Incohérence pour ${cust.name}: balance=${cust.balance}, calculé=${expectedBalance}`);
  }
});

// Génération du fichier data/seed.json
const outputData = { shop, customers, products, transactions };
const dataDir = path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(
  path.join(dataDir, 'seed.json'),
  JSON.stringify(outputData, null, 2),
  'utf-8'
);

console.log("✅ Fichier data/seed.json généré avec succès !");