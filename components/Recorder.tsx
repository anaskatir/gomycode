"use client";

import { useRef, useState } from "react";
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
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
    } catch {
      onError("Micro inaccessible. Autorise le micro dans le navigateur, ou tape la phrase ci-dessous.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Arrêter l'enregistrement" : "Parler"}
          className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition
            ${recording ? "bg-rose-500 hover:bg-rose-600" : "bg-amber-500 hover:bg-amber-600"}
            disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-40" />}
          <MicIcon />
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold text-stone-900">
            {recording ? `Enregistrement… ${seconds}s` : busy ? "Analyse en cours…" : "Parle en français"}
          </p>
          <p className="text-sm text-stone-500">
            {recording
              ? "Appuie encore pour arrêter"
              : "Exemple : « Karim a pris 3 kilos de sucre, il a payé 100, il reste 200 ». La darija marche aussi."}
          </p>
        </div>
      </div>

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
          className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
        >
          Analyser
        </button>
      </form>

      <DemoAudio busy={busy} onStart={onStart} onResult={onResult} onError={onError} />

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">Exemples · français d’abord, darija ensuite</p>
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
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-40"
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
