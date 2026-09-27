"use client";

import { useState } from "react";
import { dh, INTENT_LABEL } from "@/lib/format";
import type { TranscribeResponse } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";

type Props = {
  data: TranscribeResponse;
  busy: boolean;
  onConfirm: (choice: { customerId: string | null; newCustomerName: string | null }) => void;
  onCancel: () => void;
};

/** La vente reconnue par l'IA, à confirmer par l'épicier avant d'entrer dans la Karna. */
export function TransactionCard({ data, busy, onConfirm, onCancel }: Props) {
  const { extraction: ext, match, provider } = data;
  const [chosenId, setChosenId] = useState<string | null>(match.status === "match" ? match.candidates[0].id : null);
  const [newName, setNewName] = useState(ext.customer_name ?? "");

  const needsReview = ext.confidence < 0.7 || ext.uncertainties.length > 0 || match.status === "ambiguous";
  const needsCustomer = ext.intent === "sale" || ext.intent === "payment";
  const customerReady =
    !needsCustomer || (match.status === "new" ? newName.trim().length > 0 : chosenId !== null);
  const canConfirm = ext.intent !== "unknown" && customerReady && !busy;

  const pct = Math.round(ext.confidence * 100);
  const confColor = pct >= 80
    ? "linear-gradient(90deg, #10b981, #059669)"
    : pct >= 60
      ? "linear-gradient(90deg, var(--accent), var(--accent-dark))"
      : "linear-gradient(90deg, #ef4444, #dc2626)";

  return (
    <section
      className="glass-card p-6 animate-fade-in-up"
      style={{
        borderColor: needsReview ? "rgba(249, 115, 22, 0.25)" : "rgba(16, 185, 129, 0.25)",
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{
              background:
                ext.intent === "sale"
                  ? "rgba(249, 115, 22, 0.1)"
                  : ext.intent === "payment"
                    ? "rgba(16, 185, 129, 0.1)"
                    : ext.intent === "supplier_order"
                      ? "rgba(14, 165, 233, 0.1)"
                      : "rgba(124, 58, 237, 0.06)",
              color:
                ext.intent === "sale"
                  ? "var(--accent-dark)"
                  : ext.intent === "payment"
                    ? "#065f46"
                    : ext.intent === "supplier_order"
                      ? "#0369a1"
                      : "var(--primary)",
              border: `1px solid ${
                ext.intent === "sale"
                  ? "rgba(249, 115, 22, 0.2)"
                  : ext.intent === "payment"
                    ? "rgba(16, 185, 129, 0.2)"
                    : ext.intent === "supplier_order"
                      ? "rgba(14, 165, 233, 0.2)"
                      : "rgba(124, 58, 237, 0.12)"
              }`,
            }}
          >
            {INTENT_LABEL[ext.intent]}
          </span>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {needsReview ? "À confirmer" : "Compris"}
          </h2>
        </div>
        <SourceBadge provider={provider} />
      </header>

      <blockquote
        className="mt-4 rounded-xl px-4 py-3 italic"
        style={{
          background: "rgba(124, 58, 237, 0.04)",
          color: "var(--foreground)",
          borderLeft: "3px solid var(--primary-light)",
        }}
      >
        « {ext.transcript} »
      </blockquote>

      {/* Certitude */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--primary-light)" }}>Certitude de l&apos;IA</span>
          <span className="font-medium" style={{ color: "var(--foreground)" }}>{pct} %</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(124, 58, 237, 0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: confColor }}
          />
        </div>
      </div>

      {/* Client */}
      {needsCustomer && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--primary-light)" }}>Client</p>
          {match.status === "match" && (
            <p className="mt-1 text-base font-semibold" style={{ color: "var(--foreground)" }}>{match.candidates[0].name}</p>
          )}
          {match.status === "ambiguous" && (
            <div className="mt-2 rounded-xl p-3" style={{ background: "rgba(249, 115, 22, 0.06)", border: "1px solid rgba(249, 115, 22, 0.15)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--accent-dark)" }}>
                {match.candidates.length} clients s&apos;appellent « {ext.customer_name} ». Lequel ?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {match.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChosenId(c.id)}
                    className="rounded-lg px-3 py-1.5 text-sm transition-all duration-200"
                    style={{
                      background: chosenId === c.id ? "var(--primary)" : "white",
                      color: chosenId === c.id ? "white" : "var(--foreground)",
                      border: `1.5px solid ${chosenId === c.id ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    {c.name} <span style={{ opacity: 0.7 }}>· doit {dh(c.balance)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {match.status === "new" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="badge-primary rounded-md px-2 py-0.5 text-xs font-medium">Nouveau</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-premium flex-1"
                placeholder="Nom du client"
              />
            </div>
          )}
          {match.status === "none" && (
            <p className="mt-1 text-sm" style={{ color: "#dc2626" }}>Aucun client nommé dans la phrase.</p>
          )}
        </div>
      )}

      {/* Articles */}
      {ext.items.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--primary-light)" }}>Articles</p>
          <ul className="mt-1 divide-y" style={{ borderColor: "var(--border)" }}>
            {ext.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium capitalize" style={{ color: "var(--foreground)" }}>{it.product}</span>
                <span style={{ color: "var(--primary-light)" }}>
                  {it.quantity ?? <span style={{ color: "var(--accent)" }}>? </span>} {it.unit ?? ""}
                  {it.price !== null && <span className="ml-2" style={{ opacity: 0.6 }}>× {dh(it.price)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Montants */}
      {ext.intent !== "supplier_order" && ext.intent !== "unknown" && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Amount label="Total" value={ext.amount_total} />
          <Amount label="Payé" value={ext.amount_paid} tone="emerald" />
          <Amount label="À crédit" value={ext.intent === "payment" ? 0 : ext.amount_credit} tone="rose" />
        </div>
      )}
      {(ext.amount_total === null || (ext.intent === "sale" && ext.amount_credit === null)) &&
        ext.intent === "sale" && (
          <p className="mt-2 text-xs" style={{ color: "var(--primary-light)" }}>
            Les montants manquants seront calculés avec les prix du hanout.
          </p>
        )}

      {/* Doutes */}
      {ext.uncertainties.length > 0 && (
        <div className="mt-5 rounded-xl p-3" style={{ background: "rgba(249, 115, 22, 0.06)", border: "1px solid rgba(249, 115, 22, 0.15)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-dark)" }}>
            Ce dont l&apos;IA n&apos;est pas sûre
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" style={{ color: "var(--accent-dark)" }}>
            {ext.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() =>
            onConfirm({
              customerId: match.status === "new" ? null : chosenId,
              newCustomerName: match.status === "new" ? newName.trim() : null,
            })
          }
          className="btn-primary flex-1 py-3"
          style={{
            background: canConfirm
              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
              : undefined,
            boxShadow: canConfirm ? "0 4px 16px rgba(16, 185, 129, 0.3)" : undefined,
          }}
        >
          {busy ? "Enregistrement…" : "Confirmer et enregistrer"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="btn-secondary px-4 py-3"
        >
          Annuler
        </button>
      </footer>
    </section>
  );
}

function Amount({ label, value, tone }: { label: string; value: number | null; tone?: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "#065f46" : tone === "rose" ? "#9f1239" : "var(--foreground)";
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(124, 58, 237, 0.04)" }}>
      <p className="text-xs" style={{ color: "var(--primary-light)" }}>{label}</p>
      <p className="mt-0.5 text-lg font-semibold" style={{ color: value === null ? "var(--accent)" : color }}>
        {value === null ? "?" : dh(value)}
      </p>
    </div>
  );
}
