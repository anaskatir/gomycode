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
  const confColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";

  return (
    <section
      className={`rounded-2xl border bg-white p-6 shadow-sm ${needsReview ? "border-amber-300" : "border-emerald-300"}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              ext.intent === "sale"
                ? "bg-amber-100 text-amber-800"
                : ext.intent === "payment"
                  ? "bg-emerald-100 text-emerald-800"
                  : ext.intent === "supplier_order"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-stone-100 text-stone-600"
            }`}
          >
            {INTENT_LABEL[ext.intent]}
          </span>
          <h2 className="text-lg font-semibold text-stone-900">{needsReview ? "À confirmer" : "Compris"}</h2>
        </div>
        <SourceBadge provider={provider} />
      </header>

      <blockquote className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-stone-700 italic">« {ext.transcript} »</blockquote>

      {/* Certitude */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Certitude de l&apos;IA</span>
          <span className="font-medium text-stone-700">{pct} %</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div className={`h-full rounded-full ${confColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Client */}
      {needsCustomer && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Client</p>
          {match.status === "match" && (
            <p className="mt-1 text-base font-semibold text-stone-900">{match.candidates[0].name}</p>
          )}
          {match.status === "ambiguous" && (
            <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                {match.candidates.length} clients s&apos;appellent « {ext.customer_name} ». Lequel ?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {match.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChosenId(c.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      chosenId === c.id
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-300 bg-white text-stone-800 hover:border-stone-500"
                    }`}
                  >
                    {c.name} <span className="opacity-70">· doit {dh(c.balance)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {match.status === "new" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">Nouveau</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500"
                placeholder="Nom du client"
              />
            </div>
          )}
          {match.status === "none" && (
            <p className="mt-1 text-sm text-rose-600">Aucun client nommé dans la phrase.</p>
          )}
        </div>
      )}

      {/* Articles */}
      {ext.items.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Articles</p>
          <ul className="mt-1 divide-y divide-stone-100">
            {ext.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium capitalize text-stone-800">{it.product}</span>
                <span className="text-stone-600">
                  {it.quantity ?? <span className="text-amber-600">? </span>} {it.unit ?? ""}
                  {it.price !== null && <span className="ml-2 text-stone-400">× {dh(it.price)}</span>}
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
          <p className="mt-2 text-xs text-stone-500">Les montants manquants seront calculés avec les prix du hanout.</p>
        )}

      {/* Doutes */}
      {ext.uncertainties.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Ce dont l&apos;IA n&apos;est pas sûre</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
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
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Confirmer et enregistrer"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Annuler
        </button>
      </footer>
    </section>
  );
}

function Amount({ label, value, tone }: { label: string; value: number | null; tone?: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-stone-900";
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${value === null ? "text-amber-600" : color}`}>{value === null ? "?" : dh(value)}</p>
    </div>
  );
}
