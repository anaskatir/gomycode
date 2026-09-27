"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BalanceReminder } from "@/components/BalanceReminder";
import { Catalog } from "@/components/Catalog";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Ledger } from "@/components/Ledger";
import { RemoteOrders } from "@/components/RemoteOrders";
import { SourceBadge } from "@/components/SourceBadge";
import { TodaySales } from "@/components/TodaySales";
import { TransactionCard } from "@/components/TransactionCard";
import { dh } from "@/lib/format";
import type { ConfirmResponse, Insights, LedgerState, Provider, TranscribeResponse } from "@/lib/types";

type Phase = "idle" | "recording" | "analyzing" | "results";
type Pending = { data: TranscribeResponse; source: "voice" | "text" };

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const barsRef = useRef<Array<HTMLDivElement | null>>([]);
  const freqRef = useRef<Uint8Array | null>(null);
  const armingRef = useRef(false);
  const sessionRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
    return () => { cancelled = true; };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function updateAnalyzer() {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;
    if (!freqRef.current || freqRef.current.length !== analyzer.frequencyBinCount) {
      freqRef.current = new Uint8Array(analyzer.frequencyBinCount);
    }
    const data = freqRef.current;
    analyzer.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / barsRef.current.length));
    for (let i = 0; i < barsRef.current.length; i++) {
      const el = barsRef.current[i];
      if (!el) continue;
      const val = (data[i * step] ?? 0) / 255;
      el.style.transform = `scaleY(${Math.max(0.08, val)})`;
    }
    animationRef.current = requestAnimationFrame(updateAnalyzer);
  }

  async function sendAudio(form: FormData) {
    setPhase("analyzing");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      const data = json as TranscribeResponse;
      setProvider(data.provider);
      setPending({ data, source: "voice" });
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPhase("idle");
    }
  }

  async function sendText(inputText: string) {
    setPhase("analyzing");
    setBusy(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: JSON.stringify({ text: inputText }),
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      const data = json as TranscribeResponse;
      setProvider(data.provider);
      setPending({ data, source: "text" });
      setBusy(false);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setBusy(false);
      setPhase("idle");
    }
  }

  async function startRecording() {
    if (armingRef.current || recorderRef.current) return;
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setError("Micro non disponible. Tape la phrase ci-dessous.");
      return;
    }
    armingRef.current = true;
    const session = ++sessionRef.current;
    setError(null);
    setSeconds(0);
    setListening(false);
    setPhase("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 64;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, `phrase.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
        void sendAudio(form);
      };
      recorder.start();
      recorderRef.current = recorder;
      setListening(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      animationRef.current = requestAnimationFrame(updateAnalyzer);
    } catch {
      armingRef.current = false;
      setListening(false);
      setError("Micro inaccessible. Autorise le micro dans le navigateur.");
      setPhase("idle");
    }
  }

  function stopRecording() {
    sessionRef.current += 1;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    analyzerRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    armingRef.current = false;
    if (!recorder || recorder.state === "inactive") {
      setPhase("idle");
      setListening(false);
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    recorder.stop();
    setListening(false);
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
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
    setError(null);
    await refresh();
    setBusy(false);
    setPhase("idle");
  }

  function goBack() {
    sessionRef.current += 1;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    armingRef.current = false;
    setListening(false);
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setPending(null);
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // ──── PHASE: IDLE ────
  if (phase === "idle") {
    const clients = ledger?.customers.length ?? 0;
    const due = ledger?.customers.reduce((sum, customer) => sum + customer.balance, 0) ?? 0;
    const products = ledger?.products.length ?? 0;
    return (
      <main className="hero">
        <div className="hero-arches" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <header className="hero-nav">
          <button type="button" onClick={goBack} className="hero-brand">
            <Image src="/logo.png" alt="" width={34} height={34} priority />
            <span>Hanouti</span>
          </button>
          <div className="hero-nav-actions">
            <SourceBadge provider={provider} />
            <a href="/commander" target="_blank" rel="noopener noreferrer" className="hero-ghost">
              Vue client
            </a>
            <button type="button" onClick={() => setPhase("results")} className="hero-gold">
              La Karna
            </button>
          </div>
        </header>

        <div className="hero-stage">
          <p className="hero-kicker">{ledger ? `${ledger.shop.name} · ${ledger.shop.city}` : "Hanouti"}</p>
          <button type="button" onClick={goBack} className="hero-title">Hanouti</button>
          <p className="hero-lead">
            L&apos;épicier parle. La vente, le crédit et le stock se notent tout seuls.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={startRecording} className="hero-mic" aria-label="Commencer l'enregistrement">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </button>
          </div>

          <form
            className="idle-text-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void sendText(text.trim());
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ou tape la phrase ici…"
              className="idle-text-input"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="idle-text-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          {error && (
            <div className="phase-error">{error}</div>
          )}
        </div>

        <footer className="hero-proof">
          <span><strong>{clients}</strong> {clients > 1 ? "clients" : "client"}</span>
          <span><strong>{dh(due)}</strong> dus</span>
          <span><strong>{products}</strong> produits au rayon</span>
          <button type="button" onClick={reset} className="idle-reset-btn">
            Réinitialiser la démo
          </button>
        </footer>
      </main>
    );
  }

  // ──── PHASE: RECORDING ────
  if (phase === "recording") {
    return (
      <main className="phase-container">
        <div className="recording-content">
          {/* Timer */}
          <div className="recording-timer">{formatTime(seconds)}</div>

          {/* Waveform visualizer */}
          <div className="recording-wave">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className="recording-wave-bar"
              />
            ))}
          </div>

          <p className="recording-label">
            <span className="recording-dot" />
            {listening ? "Enregistrement en cours…" : "Préparation du micro…"}
          </p>

          {/* Stop button */}
          <button
            type="button"
            onClick={stopRecording}
            className="recording-stop-btn"
            aria-label="Arrêter l'enregistrement"
          >
            <div className="recording-stop-icon" />
          </button>
          <p className="recording-hint">Appuie pour arrêter</p>
        </div>
      </main>
    );
  }

  // ──── PHASE: ANALYZING ────
  if (phase === "analyzing") {
    return (
      <main className="phase-container">
        <div className="analyzing-content">
          <div className="analyzing-spinner">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--primary-light)" strokeWidth="2" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="analyzing-label">L&apos;IA analyse ta phrase…</p>
          <p className="analyzing-sublabel">Cela prend quelques secondes</p>
        </div>
      </main>
    );
  }

  // ──── PHASE: RESULTS ────
  return (
    <main className="results-container">
      {/* Header bar */}
      <header className="results-header">
        <div className="results-header-left">
          <button type="button" onClick={goBack} className="results-back-btn" aria-label="Retour">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <button type="button" onClick={goBack} className="results-header-brand">
            <Image src="/logo.png" alt="" width={36} height={36} />
            <span className="results-header-title">Hanouti</span>
          </button>
        </div>
        <div className="results-header-right">
          <SourceBadge provider={provider} />
          <a href="/commander" target="_blank" rel="noopener noreferrer" className="results-new-btn">
            Vue client
          </a>
          <button type="button" onClick={goBack} className="results-new-btn results-gold-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
            Nouvelle écoute
          </button>
        </div>
      </header>

      {error && (
        <div className="phase-error" style={{ margin: "0 1.5rem 1rem" }}>{error}</div>
      )}

      {/* Results grid */}
      <div className="results-grid">
        <div className="results-col">
          <div className="section-enter">
            <RemoteOrders onAccepted={() => void refresh()} />
          </div>
          {pending && (
            <div className="section-enter">
              <TransactionCard
                key={pending.data.extraction.transcript + pending.data.provider}
                data={pending.data}
                products={ledger?.products ?? []}
                busy={busy}
                onConfirm={confirm}
                onCancel={goBack}
              />
            </div>
          )}
          {result && (
            <div className="section-enter section-enter-delay-1">
              <BalanceReminder result={result} onDismiss={goBack} />
            </div>
          )}
        </div>

        <div className="results-col">
          {ledger && (
            <div className="section-enter section-enter-delay-1">
              <TodaySales state={ledger} highlightId={result?.transaction.id ?? null} />
            </div>
          )}
          {ledger && (
            <div className="section-enter section-enter-delay-2">
              <Ledger state={ledger} highlightId={result?.customer?.id ?? null} onChanged={() => void refresh()} />
            </div>
          )}
          <div className="section-enter section-enter-delay-3">
            <InsightsPanel insights={insights} />
          </div>
          {ledger && (
            <div className="section-enter section-enter-delay-3">
              <Catalog products={ledger.products} transactions={ledger.transactions} onSaved={() => void refresh()} />
            </div>
          )}
        </div>
      </div>

      <footer className="results-footer">
        Hackathon Come Build with AI · 27 septembre 2026
      </footer>
    </main>
  );
}
