import { dh } from "@/lib/format";
import type { Insights } from "@/lib/types";

/**
 * « Ton business » : d'abord les chiffres CALCULÉS depuis la Karna, ensuite le conseil.
 * Les deux sont séparés à l'écran pour que le jury voie ce qui est du calcul et ce qui est de l'IA.
 */
export function InsightsPanel({ insights }: { insights: Insights | null }) {
  if (!insights) {
    return (
      <section className="glass-card p-5">
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Ton business</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--primary-light)" }}>Chargement…</p>
      </section>
    );
  }

  const { top, slow, debtors, totals, advice, adviceSource } = insights;

  return (
    <section className="glass-card p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Ton business</h2>
        <span className="text-xs" style={{ color: "var(--primary-light)" }}>7 derniers jours</span>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Kpi label="Ventes" value={dh(totals.revenue7)} />
        <Kpi label="Donné à crédit" value={dh(totals.credit7)} tone="amber" />
        <Kpi label="Total dû" value={dh(totals.outstanding)} tone="rose" />
      </div>

      <div className="mt-5">
        <SectionTitle>Ce qui se vend le plus</SectionTitle>
        {top.length === 0 && totals.transactions === 0 && (
          <p className="mt-1 text-sm" style={{ color: "var(--primary-light)" }}>
            Pas encore de vente enregistrée.
          </p>
        )}
        <table className="mt-1 w-full text-sm">
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {top.map((p) => (
              <tr key={p.product}>
                <td className="py-1.5 font-medium capitalize" style={{ color: "var(--foreground)" }}>{p.product}</td>
                <td className="py-1.5 text-right" style={{ color: "var(--primary-light)" }}>{p.quantity} vendus</td>
                <td className="py-1.5 text-right font-medium" style={{ color: "var(--foreground)" }}>{dh(p.revenue)}</td>
                <td className="w-10 py-1.5 text-right">
                  <Trend last={p.last7} prev={p.prev7} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slow.length > 0 && (
        <div className="mt-5">
          <SectionTitle>Ce qui ne bouge plus</SectionTitle>
          <ul className="mt-1 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
            {slow.map((p) => (
              <li key={p.product} className="flex items-center justify-between py-1.5" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium capitalize" style={{ color: "var(--foreground)" }}>{p.product}</span>
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{ background: "rgba(239, 68, 68, 0.08)", color: "#dc2626" }}
                >
                  {p.daysSinceLastSale === null ? "jamais vendu" : `${p.daysSinceLastSale} j sans vente`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {debtors.length > 0 && (
        <div className="mt-5">
          <SectionTitle>À relancer</SectionTitle>
          <ul className="mt-1 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
            {debtors.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-1.5" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{d.name}</span>
                <span style={{ color: "var(--primary-light)" }}>
                  <span className="font-semibold" style={{ color: "#dc2626" }}>{dh(d.balance)}</span>
                  {d.oldestCreditDays !== null && <span className="ml-2 text-xs">depuis {d.oldestCreditDays} j</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.length > 0 && (
        <div
          className="mt-5 rounded-xl p-4"
          style={{ background: "rgba(249, 115, 22, 0.06)", border: "1px solid rgba(249, 115, 22, 0.15)" }}
        >
          <div className="flex items-center justify-between">
            <SectionTitle tone="amber">Conseil</SectionTitle>
            <span className="text-[11px]" style={{ color: "var(--accent-dark)" }}>
              {adviceSource === "rules" ? "règles simples · IA à brancher" : `IA · ${adviceSource}`}
            </span>
          </div>
          <ul className="mt-2 space-y-3">
            {advice.map((a, i) => (
              <li key={i}>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{a.darija}</p>
                <p className="text-xs" style={{ color: "var(--primary-light)" }}>{a.francais}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px]" style={{ color: "var(--primary-light)" }}>
        Chiffres calculés depuis tes ventes ({totals.transactions} transactions).
      </p>
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "amber" | "rose" }) {
  const color = tone === "amber" ? "var(--accent-dark)" : tone === "rose" ? "#dc2626" : "var(--foreground)";
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(124, 58, 237, 0.04)" }}>
      <p className="text-[11px]" style={{ color: "var(--primary-light)" }}>{label}</p>
      <p className="mt-0.5 text-base font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function SectionTitle({ children, tone }: { children: React.ReactNode; tone?: "amber" }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wide"
      style={{ color: tone === "amber" ? "var(--accent-dark)" : "var(--primary-light)" }}
    >
      {children}
    </p>
  );
}

function Trend({ last, prev }: { last: number; prev: number }) {
  if (prev === 0 && last === 0) return <span style={{ color: "var(--primary-light)", opacity: 0.4 }}>–</span>;
  if (prev === 0) return <span style={{ color: "#059669" }}>↑</span>;
  const ratio = last / prev;
  if (ratio >= 1.15) return <span style={{ color: "#059669" }}>↑</span>;
  if (ratio <= 0.85) return <span style={{ color: "#dc2626" }}>↓</span>;
  return <span style={{ color: "var(--primary-light)" }}>→</span>;
}
