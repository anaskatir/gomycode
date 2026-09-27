import { dh } from "@/lib/format";
import type { Insights } from "@/lib/types";

/**
 * « Ton business » : d'abord les chiffres CALCULÉS depuis la Karna, ensuite le conseil.
 * Les deux sont séparés à l'écran pour que le jury voie ce qui est du calcul et ce qui est de l'IA.
 */
export function InsightsPanel({ insights }: { insights: Insights | null }) {
  if (!insights) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">Ton business</h2>
        <p className="mt-2 text-sm text-stone-400">Chargement…</p>
      </section>
    );
  }

  const { top, slow, debtors, totals, advice, adviceSource } = insights;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-stone-900">Ton business</h2>
        <span className="text-xs text-stone-400">7 derniers jours</span>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Kpi label="Ventes" value={dh(totals.revenue7)} />
        <Kpi label="Donné à crédit" value={dh(totals.credit7)} tone="amber" />
        <Kpi label="Total dû" value={dh(totals.outstanding)} tone="rose" />
      </div>

      <div className="mt-5">
        <SectionTitle>Ce qui se vend le plus</SectionTitle>
        {top.length === 0 && totals.transactions === 0 && (
          <p className="mt-1 text-sm text-stone-500">Pas encore de vente enregistrée.</p>
        )}
        <table className="mt-1 w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {top.map((p) => (
              <tr key={p.product}>
                <td className="py-1.5 font-medium capitalize text-stone-800">{p.product}</td>
                <td className="py-1.5 text-right text-stone-500">{p.quantity} vendus</td>
                <td className="py-1.5 text-right font-medium text-stone-700">{dh(p.revenue)}</td>
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
          <ul className="mt-1 divide-y divide-stone-100 text-sm">
            {slow.map((p) => (
              <li key={p.product} className="flex items-center justify-between py-1.5">
                <span className="font-medium capitalize text-stone-800">{p.product}</span>
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
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
          <ul className="mt-1 divide-y divide-stone-100 text-sm">
            {debtors.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-1.5">
                <span className="font-medium text-stone-800">{d.name}</span>
                <span className="text-stone-500">
                  <span className="font-semibold text-rose-600">{dh(d.balance)}</span>
                  {d.oldestCreditDays !== null && <span className="ml-2 text-xs">depuis {d.oldestCreditDays} j</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <SectionTitle tone="amber">Conseil</SectionTitle>
            <span className="text-[11px] text-amber-700">
              {adviceSource === "rules" ? "règles simples · IA à brancher" : `IA · ${adviceSource}`}
            </span>
          </div>
          <ul className="mt-2 space-y-3">
            {advice.map((a, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-stone-900">{a.darija}</p>
                <p className="text-xs text-stone-600">{a.francais}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] text-stone-400">
        Chiffres calculés depuis tes ventes ({totals.transactions} transactions).
      </p>
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "amber" | "rose" }) {
  const color = tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-600" : "text-stone-900";
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function SectionTitle({ children, tone }: { children: React.ReactNode; tone?: "amber" }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "amber" ? "text-amber-800" : "text-stone-400"}`}>
      {children}
    </p>
  );
}

function Trend({ last, prev }: { last: number; prev: number }) {
  if (prev === 0 && last === 0) return <span className="text-stone-300">–</span>;
  if (prev === 0) return <span className="text-emerald-600">↑</span>;
  const ratio = last / prev;
  if (ratio >= 1.15) return <span className="text-emerald-600">↑</span>;
  if (ratio <= 0.85) return <span className="text-rose-600">↓</span>;
  return <span className="text-stone-400">→</span>;
}
