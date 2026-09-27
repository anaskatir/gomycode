"use client";

import { useEffect, useState } from "react";
import type { Product, Transaction } from "@/lib/types";

function soldOf(product: Product, transactions: Transaction[]): number {
  const key = product.name_fr.trim().toLowerCase();
  let sold = 0;
  for (const tx of transactions) {
    if (tx.intent !== "sale") continue;
    for (const item of tx.items) {
      if (item.product.trim().toLowerCase() === key) sold += item.quantity;
    }
  }
  return sold;
}

function remainingOf(product: Product, transactions: Transaction[]): number {
  const left = (product.stock ?? 0) - soldOf(product, transactions);
  return Math.round((left < 0 ? 0 : left) * 100) / 100;
}

function Row({
  product,
  remaining,
  onSaved,
}: {
  product: Product;
  remaining: number;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(remaining));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrice(String(product.price));
    setStock(String(remaining));
  }, [product.price, remaining]);

  async function save() {
    const nextPrice = Number(price.replace(",", "."));
    const nextStock = Number(stock.replace(",", "."));
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(nextStock) || nextStock < 0) return;
    if (nextPrice === product.price && nextStock === remaining) return;
    setBusy(true);
    await fetch("/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "product", id: product.id, price: nextPrice, stock: nextStock }),
    });
    setBusy(false);
    onSaved();
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium capitalize text-stone-800">{product.name_fr}</p>
        <p className="text-xs text-stone-400">par {product.unit}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="text-[11px] text-stone-500">
          Prix
          <input
            inputMode="decimal"
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="mt-0.5 w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-right text-sm text-stone-900"
            aria-label={`Prix de ${product.name_fr}`}
          />
        </label>
        <label className="text-[11px] text-stone-500">
          Stock
          <input
            inputMode="decimal"
            value={stock}
            disabled={busy}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="mt-0.5 w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-right text-sm text-stone-900"
            aria-label={`Stock de ${product.name_fr}`}
          />
        </label>
      </div>
    </li>
  );
}

/** Prix et stock du rayon. Le stock affiché est ce qu'il reste. */
export function Catalog({
  products,
  transactions,
  onSaved,
}: {
  products: Product[];
  transactions: Transaction[];
  onSaved: () => void;
}) {
  const sorted = [...products].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));

  return (
    <section className="glass-card p-5">
      <header>
        <h2 className="text-base font-semibold text-stone-900">Rayon</h2>
        <p className="text-xs text-stone-400">Modifie le prix ou le stock, puis clique à côté pour enregistrer.</p>
      </header>
      <ul className="mt-3 max-h-80 divide-y divide-stone-100 overflow-y-auto">
        {sorted.map((product) => (
          <Row
            key={product.id}
            product={product}
            remaining={remainingOf(product, transactions)}
            onSaved={onSaved}
          />
        ))}
      </ul>
    </section>
  );
}
