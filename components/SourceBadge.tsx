import type { Provider } from "@/lib/types";

/** Dit honnêtement d'où vient le résultat : IA en direct, ou exemple de secours. */
export function SourceBadge({ provider }: { provider: Provider | null }) {
  if (!provider) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
        <span className="h-2 w-2 rounded-full bg-stone-300" />
        En attente
      </span>
    );
  }
  if (provider === "mock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Exemple de secours · IA non branchée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      IA en direct · {provider === "gemini" ? "Gemini" : "Groq"}
    </span>
  );
}
