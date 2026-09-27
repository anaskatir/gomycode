"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SAMPLE_PHRASES } from "@/lib/samples";
import { BalanceReminder } from "@/components/BalanceReminder";
import { Catalog } from "@/components/Catalog";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Ledger } from "@/components/Ledger";
import { RemoteOrders } from "@/components/RemoteOrders";
import { SourceBadge } from "@/components/SourceBadge";
import { TodaySales } from "@/components/TodaySales";
import { TransactionCard } from "@/components/TransactionCard";
import { DemoAudio } from "@/components/DemoAudio";
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
  const [analyzerData, setAnalyzerData] = useState<number[]>(new Array(32).fill(0.1));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
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
    if (!analyzerRef.current) return;
    const data = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(data);
    const bars: number[] = [];
    const step = Math.floor(data.length / 32);
    for (let i = 0; i < 32; i++) {
      const val = data[i * step] / 255;
      bars.push(Math.max(0.05, val));
    }
    setAnalyzerData(bars);
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
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setError("Micro non disponible. Tape la phrase ci-dessous.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.75;
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
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      animationRef.current = requestAnimationFrame(updateAnalyzer);
    } catch {
      setError("Micro inaccessible. Autorise le micro dans le navigateur.");
    }
  }

  function stopRecording() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    analyzerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setAnalyzerData(new Array(32).fill(0.1));
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
    return (
      <main className="phase-container">
        <div className="phase-idle-content">
          {/* Logo */}
          <div className="idle-logo">
            <Image src="/logo.png" alt="Hanouti" width={72} height={72} priority />
          </div>

          {/* Welcome text */}
          <h1 className="idle-title">
            Bienvenue sur <span className="idle-title-accent">Hanouti</span>
          </h1>
          <p className="idle-subtitle">
            {ledger ? `${ledger.shop.name} · ${ledger.shop.city}` : "Ton assistant vocal pour la Karna"}
          </p>

          {/* Big mic button */}
          <button
            type="button"
            onClick={startRecording}
            className="idle-mic-btn"
            aria-label="Commencer l'enregistrement"
          >
            <div className="idle-mic-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </div>
          </button>
          <p className="idle-hint">Appuie pour parler</p>

          {/* Text input alternative */}
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

          {/* Sample phrases */}
          <div className="idle-samples">
            {SAMPLE_PHRASES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setText(s.text);
                  void sendText(s.text);
                }}
                className="idle-sample-chip"
              >
                {s.label}
              </button>
            ))}
          </div>

          <DemoAudio
            busy={busy}
            onStart={() => { setBusy(true); setPhase("analyzing"); }}
            onResult={(data, source) => {
              setBusy(false);
              setProvider(data.provider);
              setPending({ data, source });
              setPhase("results");
            }}
            onError={(m) => {
              setBusy(false);
              setError(m);
              setPhase("idle");
            }}
          />

          {error && (
            <div className="phase-error">{error}</div>
          )}

          {/* Bottom links */}
          <div className="idle-footer">
            <SourceBadge provider={provider} />
            <a href="/commander" target="_blank" rel="noopener noreferrer" className="results-new-btn">
              Vue client
            </a>
            <button type="button" onClick={() => setPhase("results")} className="results-new-btn">
              La Karna
            </button>
            <button type="button" onClick={reset} className="idle-reset-btn">
              Réinitialiser la démo
            </button>
          </div>
        </div>
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
            {analyzerData.map((val, i) => (
              <div
                key={i}
                className="recording-wave-bar"
                style={{
                  height: `${Math.max(4, val * 100)}%`,
                  opacity: 0.4 + val * 0.6,
                  transitionDelay: `${i * 2}ms`,
                }}
              />
            ))}
          </div>

          {/* Label */}
          <p className="recording-label">
            <span className="recording-dot" />
            Enregistrement en cours…
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
          <div className="results-header-brand">
            <Image src="/logo.png" alt="Hanouti" width={36} height={36} />
            <span className="results-header-title">Hanouti</span>
          </div>
        </div>
        <div className="results-header-right">
          <SourceBadge provider={provider} />
          <a href="/commander" target="_blank" rel="noopener noreferrer" className="results-new-btn">
            Vue client
          </a>
          <button type="button" onClick={goBack} className="results-new-btn">
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
              <Ledger state={ledger} highlightId={result?.customer?.id ?? null} />
            </div>
          )}
          <div className="section-enter section-enter-delay-3">
            <InsightsPanel insights={insights} />
          </div>
          {ledger && (
            <div className="section-enter section-enter-delay-3">
              <Catalog products={ledger.products} />
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
