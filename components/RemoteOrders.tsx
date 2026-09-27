"use client";

import { useEffect, useState } from "react";
import { dh, formatHour } from "@/lib/format";
import type { RemoteOrder } from "@/lib/types";

/** Commandes envoyées par les clients qui ne viennent pas au hanout. */
export function RemoteOrders({ onAccepted }: { onAccepted: () => void }) {
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/orders");
      const json = (await res.json()) as { orders: RemoteOrder[] };
      if (!cancelled) setOrders(json.orders ?? []);
    }
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const pending = orders.filter((o) => o.status === "pending");
  if (pending.length === 0) return null;

  async function decide(id: string, action: "accept" | "refuse") {
    setBusyId(id);
    await fetch(`/api/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: action === "accept" ? "accepted" : "refused" } : o)));
    if (action === "accept") onAccepted();
    setBusyId(null);
  }

  return (
    <section className="glass-card p-5" style={{ borderColor: "rgba(14, 165, 233, 0.28)" }}>
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-sky-950">Commandes sans venir</h2>
        <p className="text-xs font-medium text-sky-700">{pending.length} en attente</p>
      </header>
      <ul className="mt-3 space-y-3">
        {pending.map((order) => (
          <li key={order.id} className="rounded-xl border border-sky-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{order.customerName}</p>
                <p className="text-xs text-stone-500">{order.phone || "Sans numéro"}</p>
                {order.arriveAt && (
                  <p className="text-xs font-medium text-sky-800">Arrivée à {formatHour(order.arriveAt)}</p>
                )}
                {order.location?.address && (
                  <p className="text-xs text-stone-600">
                    {order.location.lat !== null && order.location.lng !== null ? (
                      <a
                        href={`https://maps.google.com/?q=${order.location.lat},${order.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {order.location.address}
                      </a>
                    ) : (
                      order.location.address
                    )}
                  </p>
                )}
              </div>
              <p className="font-semibold text-stone-900">{dh(order.total)}</p>
            </div>
            <p className="mt-2 text-sm text-stone-700">
              {order.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ")}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Payé {dh(order.amountPaid)} · dette {dh(order.amountCredit)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busyId === order.id}
                onClick={() => decide(order.id, "accept")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Noter sur la Karna
              </button>
              <button
                type="button"
                disabled={busyId === order.id}
                onClick={() => decide(order.id, "refuse")}
                className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
