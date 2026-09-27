"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscribeResponse } from "@/lib/types";

type DemoPhrase = { file: string; label: string; text: string };

type Props = {
  busy: boolean;
  onStart: () => void;
  onResult: (data: TranscribeResponse, source: "voice") => void;
  onError: (message: string) => void;
};

/**
 * « Écouter un exemple » : rejoue un audio enregistré au calme (public/demo/)
 * et l'envoie à l'analyse exactement comme si on venait de parler au micro.
 * C'est ce qu'on utilise dans la vidéo et devant le jury, à la place du micro live.
 */
export function DemoAudio({ busy, onStart, onResult, onError }: Props) {
  const [phrases, setPhrases] = useState<DemoPhrase[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/demo/phrases.json")
      .then((r) => (r.ok ? (r.json() as Promise<DemoPhrase[]>) : []))
      .then(async (list) => {
        // On ne garde que les entrées dont le fichier audio existe vraiment.
        const checks = await Promise.all(
          list.map((p) => fetch(`/demo/${p.file}`, { method: "HEAD" }).then((r) => r.ok).catch(() => false)),
        );
        if (!cancelled) setPhrases(list.filter((_, i) => checks[i]));
      })
      .catch(() => {
        if (!cancelled) setPhrases([]);
      });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  async function play(p: DemoPhrase) {
    onStart();
    setPlaying(p.file);
    try {
      const res = await fetch(`/demo/${p.file}`);
      if (!res.ok) throw new Error(`Fichier ${p.file} introuvable dans public/demo/`);
      const blob = await res.blob();

      // 1. On le fait entendre au jury
      audioRef.current?.pause();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      void audio.play().catch(() => setPlaying(null));

      // 2. On l'envoie à l'analyse, comme un enregistrement micro
      const form = new FormData();
      form.append("audio", blob, p.file);
      const r = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Erreur serveur");
      onResult(json as TranscribeResponse, "voice");
    } catch (err) {
      setPlaying(null);
      onError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  if (phrases === null) return null;

  return (
    <div className="demo-audio mt-4 pt-4">
      <p className="demo-audio-label mb-2 text-xs font-medium uppercase tracking-wide">
        Écouter un exemple enregistré
      </p>
      {phrases.length === 0 ? (
        <p className="demo-audio-label text-xs">
          Aucun audio pour l&apos;instant. Dépose les fichiers dans <code className="rounded px-1">public/demo/</code> et
          liste-les dans <code className="rounded px-1">phrases.json</code>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {phrases.map((p) => (
            <button
              key={p.file}
              type="button"
              disabled={busy}
              onClick={() => void play(p)}
              className={`demo-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-200 disabled:opacity-40 ${playing === p.file ? "demo-chip-on" : ""}`}
            >
              <PlayIcon playing={playing === p.file} />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <span className="flex h-3 items-end gap-0.5">
      <span className="h-2 w-0.5 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
      <span className="h-3 w-0.5 animate-pulse rounded-full" style={{ background: "var(--accent)", animationDelay: "150ms" }} />
      <span className="h-1.5 w-0.5 animate-pulse rounded-full" style={{ background: "var(--accent)", animationDelay: "300ms" }} />
    </span>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
