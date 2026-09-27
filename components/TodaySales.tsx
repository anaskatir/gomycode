import { dh, INTENT_LABEL } from "@/lib/format";
import type { LedgerState, Transaction } from "@/lib/types";

/** Les ventes d'aujourd'hui, la plus récente en haut : le jury voit la Karna se remplir en direct. */
export function TodaySales({ state, highlightId }: { state: LedgerState; highlightId?: string | null }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = state.transactions
    .filter((t) => new Date(t.createdAt) >= start)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const nameOf = (t: Transaction) => state.customers.find((c) => c.id === t.customerId)?.name ?? "—";
  const revenue = today.filter((t) => t.intent === "sale").reduce((s, t) => s + t.amount_total, 0);
  const collected = today.reduce((s, t) => s + t.amount_paid, 0);

  return (
    <section className="glass-card p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Aujourd&apos;hui</h2>
        <p className="text-sm" style={{ color: "var(--primary-light)" }}>
          {today.length} {today.length > 1 ? "opérations" : "opération"} · encaissé <span className="font-semibold" style={{ color: "#065f46" }}>{dh(collected)}</span>
        </p>
      </header>

      {today.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--primary-light)" }}>Aucune vente encore. Parle au micro ou lance un exemple.</p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          {today.map((t) => {
            const isNew = highlightId === t.id;
            const time = new Date(t.createdAt).toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
            const items = t.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ");
            return (
              <li
                key={t.id}
                className={`flex items-start justify-between gap-3 py-2.5 text-sm transition-all duration-300 ${
                  isNew ? "-mx-2 rounded-lg px-2 animate-fade-in-scale" : ""
                }`}
                style={isNew ? { background: "rgba(16, 185, 129, 0.08)" } : undefined}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: "var(--foreground)" }}>
                    <span style={{ color: "var(--primary-light)" }}>{time}</span> · {nameOf(t)}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--primary-light)" }}>
                    {t.intent === "payment" ? INTENT_LABEL.payment : items || INTENT_LABEL[t.intent]}
                    {t.source === "voice" && <span className="ml-1" style={{ color: "var(--accent)" }}>· voix</span>}
                    {t.source === "remote" && <span className="ml-1" style={{ color: "var(--primary)" }}>· sans venir</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {t.intent === "payment" ? (
                    <p className="font-semibold" style={{ color: "#065f46" }}>+{dh(t.amount_paid)}</p>
                  ) : (
                    <>
                      <p className="font-semibold" style={{ color: "var(--foreground)" }}>{dh(t.amount_total)}</p>
                      {t.amount_credit > 0 && <p className="text-xs" style={{ color: "#dc2626" }}>crédit {dh(t.amount_credit)}</p>}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {today.length > 0 && (
        <p className="mt-3 text-[11px]" style={{ color: "var(--primary-light)" }}>Chiffre d&apos;affaires du jour : {dh(revenue)}</p>
      )}
    </section>
  );
}
