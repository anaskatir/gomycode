import type { Customer, CustomerMatch } from "./types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retrouve le client nommé dans la phrase.
 * - un seul client correspond → match
 * - plusieurs (ex. deux Karim) → ambiguous, l'écran demande lequel
 * - aucun → new, l'écran propose de le créer
 */
export function matchCustomer(name: string | null, customers: Customer[]): CustomerMatch {
  if (!name || !name.trim()) return { status: "none", candidates: [] };
  const n = normalize(name);
  const tokens = n.split(" ");

  const exact = customers.filter((c) => normalize(c.name) === n);
  if (exact.length === 1) return { status: "match", candidates: exact };

  const partial = customers.filter((c) => {
    const ct = normalize(c.name).split(" ");
    return tokens.every((t) => ct.includes(t));
  });
  if (partial.length === 1) return { status: "match", candidates: partial };
  if (partial.length > 1) return { status: "ambiguous", candidates: partial };

  return { status: "new", candidates: [] };
}
