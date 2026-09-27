// Contrat partagé entre l'écran (personne 2), l'IA (personne 1) et les données (personne 3).
// Ne pas modifier sans prévenir les deux autres.

export type Intent = "sale" | "payment" | "supplier_order" | "unknown";
export type Provider = "gemini" | "groq" | "mock";

export type ExtractedItem = {
  product: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
};

/** Ce que renvoie l'IA (lib/ai.ts) pour une phrase d'épicier. */
export type Extraction = {
  transcript: string;
  intent: Intent;
  customer_name: string | null;
  items: ExtractedItem[];
  amount_total: number | null;
  amount_paid: number | null;
  amount_credit: number | null;
  confidence: number;
  uncertainties: string[];
};

export type Customer = { id: string; name: string; phone: string; balance: number; points: number };

export type Product = {
  id: string;
  name_darija: string;
  name_fr: string;
  unit: string;
  price: number;
  /** Stock de départ du rayon. Le reste affiché = ce stock moins les ventes. */
  stock?: number;
};

export type TransactionItem = { product: string; quantity: number; unit: string; price: number };

export type Transaction = {
  id: string;
  customerId: string | null;
  intent: Intent;
  items: TransactionItem[];
  amount_total: number;
  amount_paid: number;
  amount_credit: number;
  createdAt: string;
  source: "seed" | "voice" | "text" | "mock" | "remote";
  transcript?: string;
  confidence?: number;
  pointsEarned?: number;
};

/** Structure exacte de data/seed.json (personne 3). */
export type LedgerState = {
  shop: { name: string; city: string };
  customers: Customer[];
  products: Product[];
  transactions: Transaction[];
};

export type CustomerMatch = {
  status: "match" | "ambiguous" | "new" | "none";
  candidates: Customer[];
};

export type TranscribeResponse = {
  extraction: Extraction;
  provider: Provider;
  match: CustomerMatch;
};

export type Reminder = { message: string; waLink: string };

export type OrderLocation = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export type RemoteOrder = {
  id: string;
  customerName: string;
  phone: string;
  items: TransactionItem[];
  total: number;
  status: "pending" | "accepted" | "refused";
  createdAt: string;
  location: OrderLocation;
  /** Heure d'arrivée demandée, au format HH:MM. */
  arriveAt: string;
  /** Ce que le client paie à la livraison. */
  amountPaid: number;
  /** Ce qui reste à crédit, noté sur la Karna. */
  amountCredit: number;
};

export type ConfirmResponse = {
  transaction: Transaction;
  customer: Customer | null;
  reminder: Reminder | null;
  state: LedgerState;
};

export type ProductStat = {
  product: string;
  quantity: number;
  revenue: number;
  salesCount: number;
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
  last7: number;
  prev7: number;
  unit: string;
  /** Quantité encore en rayon. */
  stock: number;
};

export type Advice = { darija: string; francais: string };

export type Insights = {
  top: ProductStat[];
  slow: ProductStat[];
  /** Produits du rayon qui n'ont encore aucune vente. */
  unsold: ProductStat[];
  /** Tout le rayon : vendu et stock restant. */
  inventory: ProductStat[];
  debtors: (Customer & { oldestCreditDays: number | null })[];
  totals: { revenue7: number; credit7: number; outstanding: number; transactions: number };
  advice: Advice[];
  adviceSource: "rules" | "gemini" | "groq";
};
