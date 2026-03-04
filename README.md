# The Archive — Art Catalogue

A private gallery-dark web app for cataloguing paintings and artworks, with Claude AI analysis and artist voice memos.

---

## Features

- **Drag & drop** multiple painting photos at once
- **Claude AI analysis** — automatically detects style, medium, subject matter, and color palette
- **Per-work details** — title, year, place, dimensions, material
- **Voice memo** — record an "artist's story" for each work
- **Persistent** — all data saved in your browser's local storage
- **Gallery aesthetic** — dark, museum-quality UI

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Get your key at: https://console.anthropic.com

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

During setup, add your environment variable:
- Key: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repository
2. Go to https://vercel.com → New Project → Import your repo
3. In "Environment Variables", add:
   - `ANTHROPIC_API_KEY` = your key
4. Click Deploy

---

## Data & Privacy

All artwork data (images, details, voice memos) is stored in **your browser's local storage only**. Nothing is sent to any server except the images which are briefly sent to Claude's API for analysis — they are not stored by Anthropic.

---

## Extending

To add more fields (price, sale status, exhibition history), edit:
- `lib/types.ts` — add fields to the `Artwork` interface
- `components/ArtworkModal.tsx` — add form inputs
- `components/ArtworkCard.tsx` — display new fields in the grid
