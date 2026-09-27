import type { Provider } from "@/lib/types";

/** Dit honnêtement d'où vient le résultat : IA en direct, ou exemple de secours. */
export function SourceBadge({ provider }: { provider: Provider | null }) {
  if (!provider) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        style={{
          background: "rgba(124, 58, 237, 0.06)",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          color: "var(--primary-light)",
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--primary-light)", opacity: 0.5 }}
        />
        En attente
      </span>
    );
  }
  if (provider === "mock") {
    return (
      <span className="badge-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
        Exemple de secours · IA non branchée
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        color: "#065f46",
      }}
    >
      <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#10b981" }} />
      IA en direct · {provider === "gemini" ? "Gemini" : "Groq"}
    </span>
  );
}
