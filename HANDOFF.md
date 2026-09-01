# Agent handoff log

Use a **new agent chat per remaining checkpoint**. Read this file plus `PLAN.md` and only the rule files listed for that step.

## Defaults (locked)

- npm, Next.js App Router, TypeScript, Tailwind, no `src/`
- Panel: Middleware + `PANEL_PASSWORD` cookie
- Workers: one Node process (`npm run worker`)
- OSC/MIDI: local `npm run broadcast`

---

## Step 1 — Scaffolding — DONE

Next.js 16 App Router + Tailwind at repo root. Folders: `app/`, `components/`, `lib/`, `workers/`, `lib/standardize/`, `lib/osc-midi/`. `.env.example` and `.gitignore` (`.env.local` excluded). `npm run build` / `npm start` present.

## Step 2 — Supabase + panel gate — DONE (SQL not applied remotely)

DDL: `supabase/migrations/0001_bosphorus_state_logs.sql`. Review before applying in the SQL editor. Middleware gates `/dashboard`. Login at `/login`. Admin client: `lib/supabase/admin.ts` (never from `"use client"`).

**You still need:** live Supabase URL + keys.

## Step 3 — Fetchers — DONE (raw types)

Contracts in `lib/fetchers/types.ts` and `lib/fetchers/README.md`. Open-Meteo REST, AISStream WebSocket + backoff, CMEMS stub/ERDDAP. No Supabase writes.

**You still need:** `AISSTREAM_API_KEY` + confirm bbox; `CMEMS_ERDDAP_URL` or toolbox JSON.

## Step 4 — Standardizer — DONE

`toBosphorusState` + `persistState`. Type: `lib/standardize/types.ts`. Raw + `normalized` 0–1 map.

## Step 5 — Worker — DONE

`npm run worker` → `workers/index.ts`. Topology: single process. Split Railway worker service only if the web dyno cannot stay alive.

## Step 6 — Dashboard — DONE

`/dashboard` mobile-first, dark cyan/gold, Realtime via `DashboardLive`.

## Step 7 — Railway — DONE (not deployed)

`docs/RAILWAY.md`, `railway.json`. Deploy when Railway access is available.

## Step 8 — OSC/MIDI scaffold — DONE

`lib/osc-midi` + `osc.js` / `easymidi` (optional). Env: `OSC_HOST`, `OSC_PORT`.

## Step 9 — Mapping — DONE (placeholders)

`lib/osc-midi/mapping.ts` and `scale.ts`. Confirm CC numbers with the audio patch.

## Step 10 — Broadcaster — DONE (dry-run default)

`npm run broadcast`. `OSC_MIDI_DRY_RUN=true` logs instead of opening ports. Live Ableton/Max/SuperCollider calibration still outstanding.
