import { daysAgo, dh } from "@/lib/format";
import type { LedgerState } from "@/lib/types";

/** La Karna : qui doit combien, et depuis quand il n'est pas passé. */
export function Ledger({ state, highlightId }: { state: LedgerState; highlightId?: string | null }) {
  const lastByCustomer = new Map<string, string>();
  for (const tx of state.transactions) {
    if (!tx.customerId) continue;
    const prev = lastByCustomer.get(tx.customerId);
    if (!prev || prev < tx.createdAt) lastByCustomer.set(tx.customerId, tx.createdAt);
  }
  const customers = [...state.customers].sort((a, b) => b.balance - a.balance);
  const outstanding = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">La Karna</h2>
          <p className="text-xs text-stone-400">1 point pour 10 dh d&apos;achat</p>
        </div>
        <p className="text-sm text-stone-500">
          Total dû : <span className="font-semibold text-rose-600">{dh(outstanding)}</span>
        </p>
      </header>
      <ul className="mt-3 max-h-80 divide-y divide-stone-100 overflow-y-auto">
        {customers.length === 0 && (
          <li className="py-6 text-sm text-stone-500">Aucun client pour l&apos;instant. Le premier nom que tu enregistres reste ici.</li>
        )}
        {customers.map((c) => (
          <li
            key={c.id}
            className={`flex items-center justify-between py-2.5 text-sm transition ${
              highlightId === c.id ? "-mx-2 rounded-lg bg-emerald-50 px-2" : ""
            }`}
          >
            <div>
              <p className="font-medium text-stone-800">{c.name}</p>
              <p className="text-xs text-stone-400">
                {daysAgo(lastByCustomer.get(c.id))} · {c.points ?? 0} pts
              </p>
            </div>
            <p className={`font-semibold ${c.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{dh(c.balance)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
