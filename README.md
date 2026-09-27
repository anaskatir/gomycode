# Hanouti

The ledger that listens. A neighborhood grocer in Morocco speaks, the sale is saved, the customer's credit is updated, and a WhatsApp message with the new balance is ready. A customer can also order without coming in: a short quiz suggests a basket, they say where and when they will arrive, and how much they pay now. The rest is recorded as debt.

Project for the **Come Build with AI** hackathon, 27 September 2026, Morocco.

## Run

**Node.js 24** is required (`node:sqlite` stores the customers). Then:

```bash
npm install
copy .env.example .env.local
npm run dev
```

On macOS or Linux, use `cp .env.example .env.local` instead of `copy`.

Open http://localhost:3000. Paste `GEMINI_API_KEY` and `GROQ_API_KEY` into `.env.local` (see `.env.example`). Never commit that file.

Without a key, the screen runs in **demo mode** (badge "Exemple de secours"): prepared results are returned, and audio is not analyzed.

## The two screens

- **http://localhost:3000** ? the grocer. Microphone, text, ledger, incoming orders, today's sales, stock, and advice.
- **http://localhost:3000/commander** ? the customer. The **Vue client** button at the top of the grocer screen opens it. Quiz, basket, address, arrival time, pay now or later.

**La Karna** opens the grocer's board without using the microphone. **Réinitialiser la démo** clears the customers and orders on this machine.

## Data

| File | Role |
|---|---|
| `data/catalog.json` | Shelf prices and opening stock (42 products) |
| `data/seed.json` | Starting products, read when the database is empty |
| `data/soukvoice.db` | Customers, sales, points, orders. Created on launch, ignored by git |
| `data/test/` | 20 phrases used to measure extraction accuracy |

The customers on screen are the ones saved on this machine, not example names from the repo. One point is given for every 10 dh of purchases. The stock shown is opening stock minus quantities sold.

## The model

`lib/ai.ts` sends audio or text to Gemini (`gemini-3.8-flash`, then `gemini-2.5-flash`, then `gemini-2.0-flash`) and falls back to Groq (Whisper large v3 in French, then `openai/gpt-oss-20b`) if Gemini fails. The answer is checked by `lib/schema.ts` (Zod). The instruction is in `lib/prompts.ts`: French first, Darija as a fallback.

`lib/extract.ts` chooses on its own: a key in `.env.local` shows the "IA en direct" badge; no key means demo mode.

The quiz basket (`lib/basket.ts`) and the "Ton business" advice (`lib/insights.ts`) are rules, not a model call.

Accuracy check on the 20 test phrases:

```bash
npm run eval
```

## API routes

| Route | Role |
|---|---|
| `POST /api/transcribe` | Audio or text. Extracts the sale. Does not change the ledger. |
| `POST /api/ledger` | Saves the confirmed sale, updates the balance, returns the WhatsApp message |
| `GET /api/ledger` | Customers, products, transactions |
| `POST /api/ledger/reset` | Clears the demo and reloads the catalog |
| `GET /api/insights` | What sells, what does not, stock, advice |
| `GET /api/catalog` | Shelf prices for the customer page |
| `GET /api/orders` | Orders placed without coming in |
| `POST /api/orders` | The customer sends the basket, address, time, and amount paid |
| `POST /api/orders/:id` | The grocer accepts or refuses. Accepting creates the sale and the debt. |

## Honesty

- The badge at the top says where the result came from: live model (Gemini or Groq) or the fallback example.
- The "Ton business" numbers are calculated from sales. The advice is labeled as simple rules.
- A sale with no spoken amount is priced from the shelf. Whatever is not paid now becomes credit.
- WhatsApp is sent through a `wa.me` link (one tap). Automatic sending needs the Business API.

## Next

Automatic reminders, dictated supplier orders, several shops.
