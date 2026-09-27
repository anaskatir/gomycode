# SoukVoice

La Karna qui écoute la darija. Un assistant vocal pour les épiciers de quartier au Maroc (moul hanout) : l'épicier parle, la vente est enregistrée, le crédit du client est mis à jour, un message WhatsApp avec le nouveau solde est prêt, et un panneau « Ton business » lui dit ce qui se vend et ce qui ne bouge plus.

Projet du hackathon **Come Build with AI**, 27 septembre 2026, Maroc.

## Lancer

```bash
npm install
cp .env.example .env.local   # puis remplir les clés (personne 1)
npm run dev
```

Ouvre http://localhost:3000. Sans clé, l'écran marche en **mode démo** (badge « Exemple de secours ») : les boutons « Exemples » renvoient des résultats préparés, l'audio n'est pas analysé.

## Qui fait quoi

| Dossier | Responsable | Contenu |
|---|---|---|
| `lib/ai.ts`, `lib/prompts.ts`, `lib/schema.ts`, `scripts/eval.ts` | Personne 1 | Voix → JSON (Gemini, secours Groq), consigne darija, validation, mesure de justesse |
| `app/`, `components/`, `lib/store.ts`, `lib/insights.ts`, `lib/extract.ts` | Personne 2 | Écran, routes API, Karna, panneau business |
| `data/seed.json`, `data/test/`, `scripts/generate-seed.mjs`, README final, slides, vidéo | Personne 3 | Données inventées, 20 phrases test, livrables |

## Brancher l'IA (personne 1)

Le contrat est dans `lib/types.ts` (`Extraction`, `Provider`). Quand `lib/ai.ts` exporte `extractFromAudio(audio: Buffer, mimeType: string)` et `extractFromText(text: string)` qui renvoient `{ extraction, provider }`, ouvre `lib/extract.ts` et remplace le mock par `export { extractFromAudio, extractFromText } from "./ai";`. Rien d'autre à toucher : le badge passe tout seul à « IA en direct ».

## Brancher les données (personne 3)

Dépose `data/seed.json` avec la structure décrite dans `lib/types.ts` (`LedgerState`). Le fichier est lu au premier chargement ; `data/ledger.json` (ignoré par git) garde l'état courant. Le bouton « Réinitialiser la démo » repart du seed.

## Routes API

| Route | Rôle |
|---|---|
| `POST /api/transcribe` | audio (multipart `audio`) ou `{ text }` → extraction + client reconnu. Ne modifie pas la Karna. |
| `POST /api/ledger` | enregistre la transaction confirmée, met à jour le solde, renvoie le message WhatsApp |
| `GET /api/ledger` | état complet |
| `POST /api/ledger/reset` | retour au seed |
| `GET /api/insights` | top produits, produits sans vente, débiteurs, conseil |

## Honnêteté

- Toutes les données sont inventées. Les numéros `2126000000xx` n'existent pas.
- Le badge en haut dit toujours d'où vient le résultat : IA en direct (Gemini ou Groq) ou exemple de secours.
- Les chiffres du panneau « Ton business » sont calculés depuis la Karna. Le conseil est marqué « règles simples » tant que l'IA n'est pas branchée dessus.
- L'envoi WhatsApp se fait par un lien `wa.me` (un tap). L'envoi automatique demande l'API Business et fait partie de la suite.

## Suite prévue

Envoi automatique des rappels, commandes fournisseur dictées, plusieurs magasins, tendances de quartier.
