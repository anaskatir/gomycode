# Hanouti

La Karna qui écoute. Un épicier de quartier au Maroc parle, la vente est enregistrée, le crédit du client est mis à jour, et un message WhatsApp avec le nouveau solde est prêt. Le client peut aussi commander sans venir : un quiz propose un panier, il indique où et à quelle heure il passe, et combien il paie maintenant. Le reste part en dette.

Projet du hackathon **Come Build with AI**, 27 septembre 2026, Maroc.

## Lancer

Il faut **Node.js 24** (`node:sqlite` garde les clients). Puis :

```bash
npm install
copy .env.example .env.local
npm run dev
```

Sur macOS ou Linux, remplace `copy` par `cp .env.example .env.local`.

Ouvre http://localhost:3000. Colle `GEMINI_API_KEY` et `GROQ_API_KEY` dans `.env.local` (voir `.env.example`). Ne commite jamais ce fichier.

Sans clé, l'écran marche en **mode démo** (badge « Exemple de secours ») : les boutons d'exemples renvoient des résultats préparés, l'audio n'est pas analysé.

## Les deux écrans

- **http://localhost:3000** ? l'épicier. Micro, texte, Karna, commandes en attente, ventes du jour, stock, conseil.
- **http://localhost:3000/commander** ? le client. Bouton **Vue client** en haut de l'écran épicier. Quiz, panier, adresse, heure d'arrivée, paiement maintenant ou plus tard.

Le bouton **La Karna** ouvre le tableau de l'épicier sans passer par le micro. **Réinitialiser la démo** efface les clients et les commandes de cette machine.

## Données

| Fichier | Rôle |
|---|---|
| `data/catalog.json` | Prix et stock d'ouverture du rayon (42 produits) |
| `data/seed.json` | Produits de départ, lu si la base est vide |
| `data/soukvoice.db` | Clients, ventes, points, commandes. Créé au lancement, ignoré par git |
| `data/test/` | 20 phrases pour mesurer la justesse de l'extraction |

Les clients vus à l'écran sont ceux enregistrés sur la machine, pas des noms d'exemple du dépôt. Un point est donné pour 10 dh d'achat. Le stock affiché est le stock d'ouverture moins les quantités vendues.

## L'IA

`lib/ai.ts` envoie l'audio ou le texte à Gemini (`gemini-3.8-flash`, puis `gemini-2.5-flash`, puis `gemini-2.0-flash`) et bascule sur Groq (Whisper large v3 en français, puis `openai/gpt-oss-20b`) si Gemini échoue. La réponse est validée par `lib/schema.ts` (Zod). La consigne est dans `lib/prompts.ts` : français en principal, darija en secours.

`lib/extract.ts` choisit tout seul : une clé dans `.env.local` donne le badge « IA en direct » ; aucune clé donne le mode démo.

Le panier du quiz (`lib/basket.ts`) et le conseil de « Ton business » (`lib/insights.ts`) sont des règles, pas un appel à l'IA.

Mesure de justesse sur les 20 phrases test :

```bash
npm run eval
```

## Routes API

| Route | Rôle |
|---|---|
| `POST /api/transcribe` | Audio ou texte. Extrait la vente. Ne modifie pas la Karna. |
| `POST /api/ledger` | Enregistre la vente confirmée, met à jour le solde, renvoie le message WhatsApp |
| `GET /api/ledger` | Clients, produits, transactions |
| `POST /api/ledger/reset` | Vide la démo et repart du catalogue |
| `GET /api/insights` | Ce qui se vend, ce qui ne se vend pas, stock, conseil |
| `GET /api/catalog` | Prix du rayon pour la page client |
| `GET /api/orders` | Commandes sans venir |
| `POST /api/orders` | Le client envoie son panier, l'adresse, l'heure et le montant payé |
| `POST /api/orders/:id` | L'épicier accepte ou refuse. Accepter crée la vente et la dette. |

## Honnêteté

- Le badge en haut dit d'où vient le résultat : IA en direct (Gemini ou Groq) ou exemple de secours.
- Les chiffres de « Ton business » sont calculés depuis les ventes. Le conseil est marqué comme des règles simples.
- Le total d'une vente sans montant dicté est calculé avec le prix du rayon. Ce qui n'est pas payé tout de suite part à crédit.
- L'envoi WhatsApp se fait par un lien `wa.me` (un tap). L'envoi automatique demande l'API Business.

## Suite prévue

Envoi automatique des rappels, commandes fournisseur dictées, plusieurs magasins.
