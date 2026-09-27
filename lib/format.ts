export function dh(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(n)} dh`;
}

/** 18:30 → 18 h 30 */
export function formatHour(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.split(":");
  if (!h || m === undefined) return value;
  return `${h} h ${m}`;
}

export function daysAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "jamais";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export const INTENT_LABEL: Record<string, string> = {
  sale: "Vente",
  payment: "Remboursement",
  supplier_order: "Commande fournisseur",
  unknown: "Non reconnu",
};
