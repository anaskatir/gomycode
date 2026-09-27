"use client";

import { useState } from "react";
import { daysAgo, dh } from "@/lib/format";
import type { LedgerState } from "@/lib/types";

/** La Karna : qui doit combien, et depuis quand il n'est pas passé. */
export function Ledger({
  state,
  highlightId,
  onChanged,
}: {
  state: LedgerState;
  highlightId?: string | null;
  onChanged: () => void;
}) {
  const lastByCustomer = new Map<string, string>();
  for (const tx of state.transactions) {
    if (!tx.customerId) continue;
    const prev = lastByCustomer.get(tx.customerId);
    if (!prev || prev < tx.createdAt) lastByCustomer.set(tx.customerId, tx.createdAt);
  }
  const customers = [...state.customers].sort((a, b) => b.balance - a.balance);
  const outstanding = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Retirer ${name} de la Karna ?`)) return;
    setBusyId(id);
    await fetch("/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-customer", id }),
    });
    setBusyId(null);
    onChanged();
  }

  return (
    <section className="glass-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>La Karna</h2>
          <p className="text-xs" style={{ color: "var(--primary-light)" }}>1 point pour 10 dh d&apos;achat</p>
        </div>
        <p className="text-sm" style={{ color: "var(--primary-light)" }}>
          Total dû : <span className="font-semibold" style={{ color: "#dc2626" }}>{dh(outstanding)}</span>
        </p>
      </header>
      <ul className="mt-3 max-h-80 divide-y overflow-y-auto" style={{ borderColor: "var(--border)" }}>
        {customers.length === 0 && (
          <li className="py-6 text-sm" style={{ color: "var(--primary-light)" }}>
            Aucun client pour l&apos;instant. Le premier nom que tu enregistres reste ici.
          </li>
        )}
        {customers.map((c) => (
          <li
            key={c.id}
            className={`flex items-center justify-between py-2.5 text-sm transition-all duration-300 ${
              highlightId === c.id ? "-mx-2 rounded-lg px-2 animate-fade-in-scale" : ""
            }`}
            style={{
              borderColor: "var(--border)",
              ...(highlightId === c.id ? { background: "rgba(16, 185, 129, 0.08)" } : {}),
            }}
          >
            <div>
              <p className="font-medium" style={{ color: "var(--foreground)" }}>{c.name}</p>
              <p className="text-xs" style={{ color: "var(--primary-light)" }}>
                {daysAgo(lastByCustomer.get(c.id))} · {c.points ?? 0} pts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-semibold" style={{ color: c.balance > 0 ? "#dc2626" : "#059669" }}>
                {dh(c.balance)}
              </p>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => void remove(c.id, c.name)}
                className="text-xs text-stone-500 underline disabled:opacity-40"
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
