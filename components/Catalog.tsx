import { dh } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Prix de rayon utilisés quand la phrase ne donne pas de montant. */
export function Catalog({ products }: { products: Product[] }) {
  const sorted = [...products].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));

  return (
    <section className="glass-card p-5">
      <header>
        <h2 className="text-base font-semibold text-stone-900">Rayon</h2>
        <p className="text-xs text-stone-400">Prix au détail, septembre 2026. Le micro s&apos;en sert si le montant n&apos;est pas dit.</p>
      </header>
      <ul className="mt-3 max-h-80 divide-y divide-stone-100 overflow-y-auto">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <p className="font-medium capitalize text-stone-800">{p.name_fr}</p>
              <p className="text-xs text-stone-400">par {p.unit}</p>
            </div>
            <p className="font-semibold text-stone-800">{dh(p.price)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
