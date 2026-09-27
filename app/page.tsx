"use client";

import { useCallback, useEffect, useState } from "react";
import { BalanceReminder } from "@/components/BalanceReminder";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Ledger } from "@/components/Ledger";
import { Recorder } from "@/components/Recorder";
import { SourceBadge } from "@/components/SourceBadge";
import { TodaySales } from "@/components/TodaySales";
import { TransactionCard } from "@/components/TransactionCard";
import type { ConfirmResponse, Insights, LedgerState, Provider, TranscribeResponse } from "@/lib/types";

type Pending = { data: TranscribeResponse; source: "voice" | "text" };

export default function Home() {
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return Promise.all([fetch("/api/ledger"), fetch("/api/insights")])
      .then(([l, i]) => Promise.all([l.json(), i.json()]))
      .then(([l, i]) => {
        setLedger(l as LedgerState);
        setInsights(i as Insights);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/ledger"), fetch("/api/insights")])
      .then(([l, i]) => Promise.all([l.json(), i.json()]))
      .then(([l, i]) => {
        if (cancelled) return;
        setLedger(l as LedgerState);
        setInsights(i as Insights);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la Karna.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleResult(data: TranscribeResponse, source: "voice" | "text") {
    setBusy(false);
    setError(null);
    setResult(null);
    setProvider(data.provider);
    setPending({ data, source });
  }

  async function confirm(choice: { customerId: string | null; newCustomerName: string | null }) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: pending.data.extraction,
          customerId: choice.customerId,
          newCustomerName: choice.newCustomerName,
          source: pending.data.provider === "mock" ? "mock" : pending.source,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setResult(json as ConfirmResponse);
      setPending(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    await fetch("/api/ledger/reset", { method: "POST" });
    setPending(null);
    setResult(null);
    setProvider(null);
    await refresh();
    setBusy(false);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-xl font-black text-white shadow">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">SoukVoice</h1>
            <p className="text-sm text-stone-500">
              {ledger ? `${ledger.shop.name} · ${ledger.shop.city}` : "La Karna qui écoute la darija"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge provider={provider} />
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline disabled:opacity-40"
          >
            Réinitialiser la démo
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Recorder busy={busy} onStart={() => setBusy(true)} onResult={handleResult} onError={(m) => { setBusy(false); setError(m); }} />
          {pending && (
            <TransactionCard
              key={pending.data.extraction.transcript + pending.data.provider}
              data={pending.data}
              busy={busy}
              onConfirm={confirm}
              onCancel={() => setPending(null)}
            />
          )}
          {result && <BalanceReminder result={result} onDismiss={() => setResult(null)} />}
        </div>

        <div className="space-y-5">
          {ledger && <TodaySales state={ledger} highlightId={result?.transaction.id ?? null} />}
          {ledger && <Ledger state={ledger} highlightId={result?.customer?.id ?? null} />}
          <InsightsPanel insights={insights} />
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-stone-400">
        Hackathon Come Build with AI · 27 septembre 2026 · Toutes les données affichées sont inventées.
      </footer>
    </main>
  );
}
