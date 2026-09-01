# Bosphorus Data Aggregation Hub

Live Bosphorus wind, wave, current, and vessel data — stored in Supabase, shown on a mobile dashboard, and translated into OSC/MIDI for a generative audiovisual installation.

The dashboard and database are plumbing. The product is the signal.

## Quick start

```bash
cp .env.example .env.local
# fill in Supabase keys and PANEL_PASSWORD
npm install
npm run dev
```

Apply [`supabase/migrations/0001_bosphorus_state_logs.sql`](supabase/migrations/0001_bosphorus_state_logs.sql) in the Supabase SQL editor after review.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dashboard |
| `npm run build` / `npm start` | Production web (Railway) |
| `npm run worker` | 24/7 fetchers → Supabase |
| `npm run broadcast` | Local OSC/MIDI (installation machine) |

See [docs/RAILWAY.md](docs/RAILWAY.md), [HANDOFF.md](HANDOFF.md), and [PLAN.md](PLAN.md).
