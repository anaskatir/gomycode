// Panneau « Ton business » : tout est CALCULÉ à partir de la Karna.
// Le conseil est produit par des règles simples ; la personne 1 pourra brancher l'IA
// pour le reformuler en darija plus naturelle (adviceSource passera à "gemini"/"groq").

import type { Advice, Customer, Insights, LedgerState, ProductStat } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export function computeInsights(state: LedgerState, now = new Date()): Insights {
  const stats = new Map<string, ProductStat>();
  for (const p of state.products) {
    stats.set(p.name_fr, {
      product: p.name_fr,
      quantity: 0,
      revenue: 0,
      salesCount: 0,
      lastSoldAt: null,
      daysSinceLastSale: null,
      last7: 0,
      prev7: 0,
    });
  }

  let revenue7 = 0;
  let credit7 = 0;
  const firstCreditAt = new Map<string, number>();

  for (const tx of state.transactions) {
    const t = new Date(tx.createdAt).getTime();
    const age = (now.getTime() - t) / DAY;

    if (tx.intent === "sale") {
      if (age <= 7) {
        revenue7 += tx.amount_total;
        credit7 += tx.amount_credit;
      }
      if (tx.amount_credit > 0 && tx.customerId) {
        const prev = firstCreditAt.get(tx.customerId);
        if (prev === undefined || t < prev) firstCreditAt.set(tx.customerId, t);
      }
      for (const it of tx.items) {
        const s =
          stats.get(it.product) ??
          ({
            product: it.product,
            quantity: 0,
            revenue: 0,
            salesCount: 0,
            lastSoldAt: null,
            daysSinceLastSale: null,
            last7: 0,
            prev7: 0,
          } as ProductStat);
        s.quantity += it.quantity;
        s.revenue += it.quantity * it.price;
        s.salesCount += 1;
        if (!s.lastSoldAt || new Date(s.lastSoldAt).getTime() < t) s.lastSoldAt = tx.createdAt;
        if (age <= 7) s.last7 += it.quantity;
        else if (age <= 14) s.prev7 += it.quantity;
        stats.set(it.product, s);
      }
    }
  }

  const all = [...stats.values()].map((s) => ({
    ...s,
    revenue: Math.round(s.revenue),
    daysSinceLastSale: s.lastSoldAt ? Math.floor((now.getTime() - new Date(s.lastSoldAt).getTime()) / DAY) : null,
  }));

  const sold = all.filter((s) => s.salesCount > 0);
  const top = [...sold].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const slow = sold
    .filter((s) => s.daysSinceLastSale !== null && s.daysSinceLastSale >= 10)
    .sort((a, b) => (b.daysSinceLastSale ?? 0) - (a.daysSinceLastSale ?? 0))
    .slice(0, 5);

  const debtors = state.customers
    .filter((c) => c.balance > 0)
    .map((c) => {
      const first = firstCreditAt.get(c.id);
      return { ...c, oldestCreditDays: first ? Math.floor((now.getTime() - first) / DAY) : null };
    })
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const outstanding = state.customers.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return {
    top,
    slow,
    debtors,
    totals: {
      revenue7: Math.round(revenue7),
      credit7: Math.round(credit7),
      outstanding: Math.round(outstanding),
      transactions: state.transactions.length,
    },
    advice: rulesAdvice(top, slow, debtors),
    adviceSource: "rules",
  };
}

function rulesAdvice(
  top: ProductStat[],
  slow: ProductStat[],
  debtors: (Customer & { oldestCreditDays: number | null })[],
): Advice[] {
  const advice: Advice[] = [];

  const daily = top.filter((t) => t.last7 > 0).slice(0, 2);
  if (daily.length) {
    const names = daily.map((d) => d.product).join(" w ");
    advice.push({
      darija: `${names} kay-tba3o kol nhar, khelli dima stock kafi.`,
      francais: `${daily.map((d) => d.product).join(" et ")} se vendent tous les jours, garde toujours du stock.`,
    });
  }

  const dead = slow.filter((s) => (s.daysSinceLastSale ?? 999) >= 10).slice(0, 2);
  for (const s of dead) {
    const days = s.daysSinceLastSale === null ? "bezzaf" : `${s.daysSinceLastSale} yam`;
    advice.push({
      darija: `${s.product} ma tba3 ${days === "bezzaf" ? "walou" : `men ${days}`}, dir promo wla ma t3awedch tchrih.`,
      francais:
        s.daysSinceLastSale === null
          ? `${s.product} ne s'est jamais vendu : fais une promo ou arrête d'en commander.`
          : `${s.product} ne s'est pas vendu depuis ${s.daysSinceLastSale} jours : fais une promo ou arrête d'en commander.`,
    });
  }

  const dropping = top.find((t) => t.prev7 > 0 && t.last7 < t.prev7 * 0.6);
  if (dropping) {
    advice.push({
      darija: `${dropping.product} n9es had simana (${dropping.last7} f blast ${dropping.prev7}), chouf wach l-prix wla stock.`,
      francais: `${dropping.product} a baissé cette semaine (${dropping.last7} contre ${dropping.prev7}) : vérifie le prix ou le stock.`,
    });
  }

  const old = debtors.find((d) => (d.oldestCreditDays ?? 0) >= 14 && d.balance >= 100);
  if (old) {
    advice.push({
      darija: `${old.name.split(" ")[0]} 3lih ${old.balance} dh men ${old.oldestCreditDays} yam, sift lih rappel b WhatsApp.`,
      francais: `${old.name} doit ${old.balance} dh depuis ${old.oldestCreditDays} jours : envoie-lui un rappel WhatsApp.`,
    });
  }

  return advice.slice(0, 4);
}
