"use client";

import { useEffect, useState } from "react";
import { suggestBasket, type QuizAnswers } from "@/lib/basket";
import { dh, formatHour } from "@/lib/format";
import type { Product, RemoteOrder } from "@/lib/types";

type Catalog = { shop: { name: string; city: string }; products: Product[] };
type Step = "quiz" | "panier";

const ARRIVAL_HOURS = ["11:00", "13:00", "16:00", "18:00", "20:00"];
type PayChoice = "now" | "part" | "later";

const QUESTIONS: {
  key: keyof QuizAnswers;
  prompt: string;
  options: { id: string; label: string }[];
}[] = [
  {
    key: "people",
    prompt: "Combien de personnes mangent à la maison ?",
    options: [
      { id: "1", label: "Juste moi" },
      { id: "2-3", label: "2 ou 3" },
      { id: "4+", label: "4 ou plus" },
    ],
  },
  {
    key: "days",
    prompt: "Tu commandes pour combien de temps ?",
    options: [
      { id: "2", label: "Deux jours" },
      { id: "7", label: "La semaine" },
    ],
  },
  {
    key: "morning",
    prompt: "Le matin, vous prenez quoi ?",
    options: [
      { id: "the", label: "Thé" },
      { id: "cafe", label: "Café" },
      { id: "both", label: "Les deux" },
    ],
  },
  {
    key: "children",
    prompt: "Il y a des enfants ?",
    options: [
      { id: "yes", label: "Oui" },
      { id: "no", label: "Non" },
    ],
  },
  {
    key: "cooks",
    prompt: "Tu cuisines à la maison ?",
    options: [
      { id: "yes", label: "Souvent" },
      { id: "no", label: "Peu" },
    ],
  },
];

function ProductRow({
  product,
  quantity,
  onChange,
}: {
  product: Product;
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="font-medium capitalize text-stone-900">{product.name_fr}</p>
        <p className="text-xs text-stone-500">
          {dh(product.price)} / {product.unit}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(quantity - 1)}
          className="h-8 w-8 rounded-lg border border-stone-300 text-lg leading-none text-stone-700"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          className="h-8 w-8 rounded-lg text-lg leading-none text-white"
          style={{ background: "var(--accent)" }}
        >
          +
        </button>
      </div>
    </li>
  );
}

/** Page client : quiz, panier proposé, puis adresse. */
export default function CommanderPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState<Step>("quiz");
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [arriveAt, setArriveAt] = useState("");
  const [payChoice, setPayChoice] = useState<PayChoice | null>(null);
  const [paidInput, setPaidInput] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<RemoteOrder | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => setError("Le hanout ne répond pas."));
  }, []);

  const products = [...(catalog?.products ?? [])].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));
  const chosen = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const extras = products.filter((p) => (qty[p.id] ?? 0) === 0);
  const lines = chosen.map((p) => ({ product: p, quantity: qty[p.id] }));
  const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.product.price, 0) * 100) / 100;
  const paidNow =
    payChoice === "now" ? total : payChoice === "later" ? 0 : payChoice === "part" ? Number(paidInput.replace(",", ".")) : Number.NaN;
  const amountPaid = Number.isFinite(paidNow) ? Math.round(paidNow * 100) / 100 : Number.NaN;
  const amountCredit = Number.isFinite(amountPaid) ? Math.round((total - amountPaid) * 100) / 100 : Number.NaN;
  const payReady =
    payChoice === "now" || payChoice === "later" || (payChoice === "part" && amountPaid > 0 && amountPaid < total);
  const current = QUESTIONS[question];

  function choose(id: string) {
    if (!catalog || !current) return;
    const value = id === "yes" ? true : id === "no" ? false : id;
    const next = { ...answers, [current.key]: value } as Partial<QuizAnswers>;
    setAnswers(next);
    if (question < QUESTIONS.length - 1) {
      setQuestion(question + 1);
      return;
    }
    setQty(suggestBasket(catalog.products, next as QuizAnswers));
    setStep("panier");
  }

  function setProductQty(id: string, nextQty: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(30, nextQty)) }));
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Ce téléphone ne donne pas la position. Écris le quartier.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Position refusée. Écris quand même le quartier.");
        setLocating(false);
      },
    );
  }

  async function submit() {
    if (!name.trim() || !address.trim() || !arriveAt || !payReady || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          arriveAt,
          amountPaid,
          lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Commande impossible.");
      setOrder(json.order as RemoteOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commande impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (order && catalog) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <p className="text-sm text-stone-500">{catalog.shop.name}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">Commande envoyée</h1>
        <p className="mt-3 text-stone-700">
          {order.customerName}, le hanout prépare ton panier pour {order.location.address}
          {order.arriveAt ? ` à ${formatHour(order.arriveAt)}` : ""}. Tu paies {dh(order.amountPaid)} maintenant.
          {order.amountCredit > 0 ? ` Dette notée : ${dh(order.amountCredit)}.` : " Rien en dette."}
        </p>
        <ul className="glass-card mt-4 divide-y divide-stone-200">
          {order.items.map((item) => (
            <li key={item.product} className="flex justify-between px-4 py-3 text-sm">
              <span>
                {item.quantity} {item.unit} {item.product}
              </span>
              <span className="font-medium">{dh(item.quantity * item.price)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setOrder(null);
            setStep("quiz");
            setQuestion(0);
            setAnswers({});
            setQty({});
            setArriveAt("");
            setPayChoice(null);
            setPaidInput("");
            setCoords(null);
          }}
          className="mt-6 w-full rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-800"
        >
          Nouvelle commande
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <p className="text-sm text-stone-500">{catalog ? `${catalog.shop.name} · ${catalog.shop.city}` : "Hanout"}</p>
      <h1 className="mt-1 text-2xl font-bold text-stone-900">Commander sans venir</h1>

      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {step === "quiz" && current && (
        <section className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Question {question + 1} / {QUESTIONS.length}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">{current.prompt}</h2>
          <div className="mt-4 grid gap-2">
            {current.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                className="glass-card px-4 py-3 text-left text-sm font-medium text-stone-800"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "panier" && (
        <>
          <p className="mt-2 text-sm text-stone-600">
            Panier conçu pour tes réponses. Tu peux enlever ou ajouter avant d&apos;envoyer.
          </p>
          <div className="mt-5 grid gap-3">
            <label className="text-sm">
              <span className="text-stone-600">Ton nom</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500"
                placeholder="Fatima"
              />
            </label>
            <label className="text-sm">
              <span className="text-stone-600">Téléphone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500"
                placeholder="06…"
              />
            </label>
            <label className="text-sm">
              <span className="text-stone-600">Où livrer</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500"
                placeholder="Hay Mohammadi, rue 12"
              />
            </label>
            <button
              type="button"
              onClick={locate}
              className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900"
            >
              {locating ? "Recherche…" : coords ? "Position reçue" : "Utiliser ma position"}
            </button>
            <div className="text-sm">
              <span className="text-stone-600">Heure d&apos;arrivée</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ARRIVAL_HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => setArriveAt(hour)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                      arriveAt === hour
                        ? "border-amber-500 bg-amber-50 text-amber-950"
                        : "border-stone-300 bg-white text-stone-800"
                    }`}
                  >
                    {formatHour(hour)}
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={arriveAt}
                onChange={(e) => setArriveAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-sm">
              <span className="text-stone-600">Comment tu paies ?</span>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    ["now", "Je paie tout maintenant"],
                    ["part", "Je paie une partie"],
                    ["later", "Je paie plus tard"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayChoice(id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                      payChoice === id
                        ? "border-amber-500 bg-amber-50 text-amber-950"
                        : "border-stone-300 bg-white text-stone-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {payChoice === "part" && (
                <label className="mt-3 block">
                  <span className="text-stone-600">Combien tu paies maintenant ?</span>
                  <input
                    inputMode="decimal"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500"
                    placeholder="50"
                  />
                </label>
              )}
              {payReady && (
                <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-stone-700">
                  Payé maintenant : {dh(amountPaid)}. Dette : {dh(amountCredit)}.
                </p>
              )}
              {payChoice === "part" && paidInput.trim() !== "" && !payReady && (
                <p className="mt-2 text-rose-700">Le montant doit être entre 0 et {dh(total)}.</p>
              )}
            </div>
          </div>

          <h2 className="mt-5 text-sm font-semibold text-stone-900">Ton panier</h2>
          <ul className="glass-card mt-2 divide-y" style={{ borderColor: "rgba(249, 115, 22, 0.25)" }}>
            {chosen.map((p) => (
              <ProductRow key={p.id} product={p} quantity={qty[p.id] ?? 0} onChange={(n) => setProductQty(p.id, n)} />
            ))}
          </ul>

          <h2 className="mt-5 text-sm font-semibold text-stone-500">Écrit juste pour vous</h2>
          <ul className="glass-card mt-2 max-h-64 divide-y overflow-y-auto">
            {extras.map((p) => (
              <ProductRow key={p.id} product={p} quantity={0} onChange={(n) => setProductQty(p.id, n)} />
            ))}
          </ul>

          <div className="sticky bottom-0 mt-4 py-3">
            <button
              type="button"
              disabled={busy || !name.trim() || !address.trim() || !arriveAt || !payReady || lines.length === 0}
              onClick={submit}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dark))" }}
            >
              {busy ? "Envoi…" : `Envoyer la commande · ${dh(total)}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
