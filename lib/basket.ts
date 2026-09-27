import { normalize } from "./matchCustomer";
import type { Product } from "./types";

export type QuizAnswers = {
  people: "1" | "2-3" | "4+";
  days: "2" | "7";
  morning: "the" | "cafe" | "both";
  children: boolean;
  cooks: boolean;
};

/** Panier proposé à partir des réponses, avec les produits du rayon. */
export function suggestBasket(products: Product[], quiz: QuizAnswers): Record<string, number> {
  const byName = new Map(products.map((p) => [normalize(p.name_fr), p]));
  const people = quiz.people === "1" ? 1 : quiz.people === "2-3" ? 3 : 5;
  const week = quiz.days === "7";
  const qty: Record<string, number> = {};

  function add(name: string, n: number) {
    const product = byName.get(normalize(name));
    if (!product || n <= 0) return;
    qty[product.id] = Math.min(30, Math.max(1, Math.round(n)));
  }

  add("pain", Math.min(10, people * (week ? 4 : 2)));
  add("pommes de terre", people === 1 ? 1 : 2);
  add("tomates", people === 1 ? 1 : 2);
  add("oignons", 1);
  add("eau", Math.min(6, people));
  if (week) add("huile", 1);
  if (quiz.morning === "the" || quiz.morning === "both") add("thé", 1);
  if (quiz.morning === "cafe" || quiz.morning === "both") add("café", 1);
  add("lait", quiz.children ? Math.min(6, people + 1) : 2);
  if (quiz.children) {
    add("yaourt", Math.min(8, people * 2));
    add("biscuits", 1);
  }
  if (quiz.cooks) {
    add("sucre", 1);
    add("sauce tomate", week ? 2 : 1);
    if (week) add("farine", 1);
  }

  return qty;
}
