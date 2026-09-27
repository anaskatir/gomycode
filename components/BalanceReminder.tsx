import { dh, INTENT_LABEL } from "@/lib/format";
import type { ConfirmResponse } from "@/lib/types";

/** Après confirmation : le nouveau solde du client et le message WhatsApp prêt à envoyer. */
export function BalanceReminder({ result, onDismiss }: { result: ConfirmResponse; onDismiss: () => void }) {
  const { customer, reminder, transaction } = result;

  if (!customer || !reminder) {
    return (
      <section
        className="glass-card p-5 animate-fade-in-up"
        style={{ borderColor: "rgba(14, 165, 233, 0.2)" }}
      >
        <p className="font-semibold" style={{ color: "var(--primary-dark)" }}>
          {INTENT_LABEL[transaction.intent]} enregistrée.
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--primary-light)" }}>
          {transaction.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ") || "Sans article."}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-sm font-medium underline"
          style={{ color: "var(--primary)" }}
        >
          Fermer
        </button>
      </section>
    );
  }

  const owes = customer.balance > 0;

  return (
    <section
      className="glass-card p-6 animate-fade-in-up"
      style={{ borderColor: "rgba(16, 185, 129, 0.25)" }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#065f46" }}>
            Enregistré dans la Karna
          </p>
          <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--foreground)" }}>{customer.name}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "var(--primary-light)" }}>Nouveau solde</p>
          <p className="text-2xl font-bold" style={{ color: owes ? "#dc2626" : "#059669" }}>
            {dh(customer.balance)}
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--accent-dark)" }}>
            {customer.points ?? 0} pts
            {transaction.pointsEarned ? ` · +${transaction.pointsEarned}` : ""}
          </p>
        </div>
      </header>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--primary-light)" }}>
          Message pour le client
        </p>
        <div
          className="mt-2 max-w-md rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm"
          style={{ background: "#dcf8c6", color: "var(--foreground)" }}
        >
          {reminder.message}
        </div>
      </div>

      <footer className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={reminder.waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-95"
          style={{ background: "#25D366", boxShadow: "0 4px 16px rgba(37, 211, 102, 0.3)" }}
        >
          <WhatsAppIcon /> Envoyer sur WhatsApp
        </a>
        <button type="button" onClick={onDismiss} className="btn-secondary px-4 py-3">
          Nouvelle vente
        </button>
        <span className="text-xs" style={{ color: "var(--primary-light)" }}>
          Numéro fictif de démo · l&apos;envoi automatique sans tap est prévu ensuite.
        </span>
      </footer>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5s0-.4-.1-.5c-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  );
}
