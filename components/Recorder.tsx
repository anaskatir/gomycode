"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { SAMPLE_PHRASES } from "@/lib/samples";
import type { TranscribeResponse } from "@/lib/types";
import { DemoAudio } from "./DemoAudio";

type Source = "voice" | "text";

type Props = {
  busy: boolean;
  onStart: () => void;
  onResult: (data: TranscribeResponse, source: Source) => void;
  onError: (message: string) => void;
};

export function Recorder({ busy, onStart, onResult, onError }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [analyzerData, setAnalyzerData] = useState<number[]>(new Array(24).fill(0.15));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateAnalyzer = useCallback(() => {
    if (!analyzerRef.current) return;
    const data = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(data);

    // Sample 24 bars across the frequency spectrum
    const bars: number[] = [];
    const step = Math.floor(data.length / 24);
    for (let i = 0; i < 24; i++) {
      const val = data[i * step] / 255;
      bars.push(Math.max(0.08, val));
    }
    setAnalyzerData(bars);
    animationRef.current = requestAnimationFrame(updateAnalyzer);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function send(body: FormData | { text: string }, source: Source) {
    onStart();
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: body instanceof FormData ? body : JSON.stringify(body),
        headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      onResult(json as TranscribeResponse, source);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      onError("Micro non disponible dans ce navigateur. Tape la phrase ci-dessous.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyzer for wave visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.7;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, `phrase.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
        void send(form, "voice");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      animationRef.current = requestAnimationFrame(updateAnalyzer);
    } catch {
      onError("Micro inaccessible. Autorise le micro dans le navigateur, ou tape la phrase ci-dessous.");
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
    setRecording(false);
    setAnalyzerData(new Array(24).fill(0.15));
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <section className="glass-card p-6 animate-fade-in-up">
      <div className="flex flex-col items-center gap-5">
        {/* Mic button with wave animation */}
        <div className="relative flex items-center justify-center">
          {/* Pulse rings when recording */}
          {recording && (
            <>
              <span
                className="absolute rounded-full animate-pulse-ring"
                style={{
                  width: "9rem",
                  height: "9rem",
                  border: "2px solid var(--accent)",
                  animationDelay: "0s",
                }}
              />
              <span
                className="absolute rounded-full animate-pulse-ring"
                style={{
                  width: "10rem",
                  height: "10rem",
                  border: "1.5px solid var(--accent-light)",
                  animationDelay: "0.5s",
                }}
              />
            </>
          )}

          <button
            type="button"
            disabled={busy && !recording}
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? "Arrêter l'enregistrement" : "Parler"}
            className={`mic-button ${recording ? "recording" : ""}`}
          >
            {recording ? (
              /* Wave bars animation */
              <div className="wave-container">
                {analyzerData.slice(0, 7).map((val, i) => (
                  <div
                    key={i}
                    className="wave-bar"
                    style={{
                      height: `${Math.max(8, val * 40)}px`,
                      animationDelay: `${i * 0.08}s`,
                      opacity: 0.7 + val * 0.3,
                      transition: "height 0.05s ease",
                    }}
                  />
                ))}
              </div>
            ) : busy ? (
              /* Loading spinner when analyzing */
              <div className="flex items-center justify-center">
                <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ) : (
              /* Mic icon with subtle bounce */
              <div className="animate-mic-bounce">
                <MicIcon />
              </div>
            )}
          </button>
        </div>

        {/* Audio waveform visualizer (shown during recording) */}
        {recording && (
          <div className="flex items-end gap-[2px] h-10 px-4 w-full max-w-xs animate-fade-in-scale">
            {analyzerData.map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(3, val * 40)}px`,
                  background: `linear-gradient(to top, var(--accent), var(--primary))`,
                  opacity: 0.5 + val * 0.5,
                }}
              />
            ))}
          </div>
        )}

        {/* Status text */}
        <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {recording ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full animate-pulse"
                  style={{ background: "var(--accent)" }}
                />
                Enregistrement… {formatTime(seconds)}
              </span>
            ) : busy ? (
              "Analyse en cours…"
            ) : (
              "Appuie pour parler"
            )}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--primary-light)" }}>
            {recording
              ? "Appuie encore pour arrêter"
              : busy
                ? "L'IA analyse ta phrase…"
                : "Français ou darija · ex: « Karim a pris 3 kilos de sucre »"}
          </p>
        </div>
      </div>

      {/* Text input */}
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void send({ text: text.trim() }, "text");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder="Ou tape la phrase en français…"
          className="input-premium flex-1"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="btn-primary"
        >
          Analyser
        </button>
      </form>

      <DemoAudio busy={busy} onStart={onStart} onResult={onResult} onError={onError} />

      {/* Sample phrases */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--primary-light)" }}>
          Exemples · français d'abord, darija ensuite
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PHRASES.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={busy}
              onClick={() => {
                setText(s.text);
                void send({ text: s.text }, "text");
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-40 hover:scale-[1.03]"
              style={{
                background: "rgba(124, 58, 237, 0.06)",
                color: "var(--primary-dark)",
                border: "1px solid rgba(124, 58, 237, 0.12)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(124, 58, 237, 0.12)";
                e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(124, 58, 237, 0.06)";
                e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.12)";
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MicIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
