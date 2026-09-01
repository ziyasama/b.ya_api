# Bosphorus Data Aggregation Hub

Live Bosphorus wind, wave, current, and vessel data — stored in Supabase, shown on a mobile dashboard, and translated into OSC/MIDI for a generative audiovisual installation.

The dashboard and database are plumbing. The product is the signal.

## Quick start

```bash
cp .env.example .env.local
# fill in Supabase keys
npm install
npm run dev
```

Apply [`supabase/migrations/0001_bosphorus_state_logs.sql`](supabase/migrations/0001_bosphorus_state_logs.sql) in the Supabase SQL editor after review.

Public routes:

- `/` — live wind/wave/current/vessel state. Tap the source-status pills (top right) to swap the live grids for the scan area map in place.
- `/map` — same map full-page: the two AISStream bounding boxes and the Open-Meteo/CMEMS sample point, with a legend and a leftover-work status panel. Geometry comes from `lib/env.ts` / `.env.example`, the same source `lib/fetchers/aisstream.ts` subscribes with.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dashboard |
| `npm run build` / `npm start` | Production web (Railway) |
| `npm run worker` | 24/7 fetchers → Supabase |
| `npm run broadcast` | Local OSC/MIDI (installation machine) |

See [docs/RAILWAY.md](docs/RAILWAY.md), [HANDOFF.md](HANDOFF.md), and [PLAN.md](PLAN.md).
