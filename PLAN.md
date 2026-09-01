# Bosphorus Data Aggregation Hub — Master Plan

> Status: **IMPLEMENTED IN REPO — awaiting credentials, SQL apply, and live calibration**
> Governing rules live in `.cursor/rules/` (`router.md`, `backend.md`, `frontend.md`, `database.md`, `osc-midi.md`, `deployment.md`). This plan is the chronological execution roadmap derived from those rules. It will be kept in sync as an SSOT alongside the rule files — updated non-destructively as the project evolves.

## 0. Guiding Principle
The dashboard and database are not the end product — they are the plumbing. The end product is a live translation of Bosphorus wind/wave/current/vessel data into **OSC and MIDI signals** for a generative audiovisual installation. Every schema and normalization decision (Phase 1) must anticipate the signal-mapping needs of Phase 2.

We proceed **one phase/step at a time**. Each step below ends with a checkpoint requiring explicit approval before moving to the next. No assumptions will be made on architecture, package choices, or API integration details — open questions are called out inline and will be asked as `AskQuestion` prompts when we reach that step.

See [HANDOFF.md](HANDOFF.md) for agent-to-agent status.

---

## Phase 1 — Foundation & Data Pipeline

### Step 1: Project Scaffolding — DONE
- Initialize Next.js app (App Router) with TypeScript + Tailwind CSS.
- Set up base folder structure: `/app`, `/components`, `/lib`, `/workers`, `/lib/standardize`, `/lib/osc-midi` (stub for Phase 2).
- Add `.env.example` documenting all required variables (Supabase URL/keys, Panel Password, third-party API keys) per `deployment.md`.
- Add `.gitignore` (ensure `.env.local` excluded).
- **Defaults used:** npm, Next.js 16, no `src/` directory.

### Step 2: Supabase Database Setup — DONE (apply SQL in dashboard)
- Create Supabase project (or connect to existing one — need credentials).
- Design and migrate schema for `bosphorus_state_logs`:
  - `id`, `created_at` (timestamp, indexed), `wind_speed`, `wave_height`, `sea_surface_temp`, `current_direction`, `current_u`, `current_v`, `salinity`, `water_density`, `vessel_count`, `vessel_data` (jsonb for MMSI/coords/size array), `source_status` (jsonb — tracks per-API health/fallback state).
  - Time-series table: append-only, never delete (per `database.md`).
- Set up Row Level Security policies (service role for writers, restricted/read-only for the panel).
- Implement password-protection middleware for `/dashboard` (Next.js Middleware + `PANEL_PASSWORD` env var, or Supabase Auth — **decision needed**).
- Configure Supabase Realtime on the logs table for live dashboard updates.
- **Decisions:** Cloud Supabase; Middleware + `PANEL_PASSWORD`. SQL file: `supabase/migrations/0001_bosphorus_state_logs.sql`.
- **Checkpoint:** review schema DDL before applying migration.

### Step 3: Data Fetcher Workers (Backend) — DONE
Build one standalone fetcher module per source, each independently fault-tolerant (never crash the process; log + fallback to last known good value on failure):
- **Open-Meteo (Marine & Weather API):** wind speed, wave height, sea surface temperature. REST polling on an interval.
- **AISStream.io (WebSocket) / MarineTraffic:** vessel count, MMSI/size, coordinates within Bosphorus bounding box. Persistent WebSocket connection with reconnect/backoff logic.
- **Copernicus Marine (CMEMS) / EMODnet:** current vectors (U/V), salinity, water density/pressure. Likely NetCDF or subset API — needs investigation into access method (CMEMS Toolbox vs. REST subsetting API vs. scheduled file download).
- **Open questions:** exact CMEMS access credentials/product IDs, AISStream.io API key and bounding box coordinates for the Bosphorus, polling intervals per source (balancing freshness vs. rate limits).
- **Checkpoint:** confirm each fetcher's raw output shape before building the standardizer. See `lib/fetchers/README.md`.

### Step 4: Data Standardization Layer — DONE
- Build a strict standardizer function that maps all chaotic third-party payloads into one unified `BosphorusState` object.
- Normalize values into predictable numeric ranges anticipating later audio-parameter mapping (e.g., wind speed → 0.0–1.0).
- Write the standardized state to `bosphorus_state_logs` on each fetch cycle.
- **Checkpoint:** review the finalized `BosphorusState` TypeScript type/interface — this becomes the contract for both the dashboard and the OSC/MIDI layer. See `lib/standardize/types.ts`.

### Step 5: Background Execution — DONE
- Implement scheduling so fetchers run 24/7 independent of UI traffic (cron job vs. persistent worker process vs. Railway cron service — **decision needed**, since AISStream requires a long-lived WebSocket rather than simple interval polling).
- Ensure graceful error handling, retry/backoff, and logging across all workers.
- **Decision:** single long-lived process (`npm run worker`).
- **Checkpoint:** confirm worker deployment topology (single process running fetchers concurrently vs. separate Railway services).

---

## Phase 2 — Presentation Layer

### Step 6: Mobile-First Next.js Dashboard — DONE
- Build `/dashboard` route (password-protected) as the primary client-facing view, mobile-first via Tailwind.
- Dark-mode "data-hub" aesthetic: cyan/gold accents, minimal borders.
- Wire up Supabase Realtime subscription for instant updates on new log rows — no manual refresh.
- Build modular components (`/components`): textual indicators, simple gauges/trend arrows (e.g., "Wind: Increasing") for each `BosphorusState` field.
- Use server components by default; `"use client"` only for the realtime dashboard view.
- **Checkpoint:** review wireframe/layout approach before implementation.

### Step 7: Railway Deployment (Initial) — DONE (config; deploy pending credentials)
- Verify `npm run build` / `npm start` work cleanly in a stateless container (no local filesystem dependencies).
- Document and configure environment variables in Railway dashboard per `.env.example`.
- Deploy Phase 1 + Phase 2 (data pipeline + dashboard) and validate live data flow end-to-end in production.
- **Checkpoint:** confirm production deployment is stable before starting Phase 3. See `docs/RAILWAY.md`.

---

## Phase 3 — OSC/MIDI Output Layer

### Step 8: OSC/MIDI Infrastructure Scaffolding — DONE
- Structure `/lib/osc-midi` to consume the same `BosphorusState` contract established in Step 4.
- Integrate `osc.js` (UDP OSC messaging) and `easymidi` (virtual MIDI ports).
- **Open questions:** target host/port for OSC (local network vs. same machine as Ableton/Max/SuperCollider), whether the MIDI/OSC broadcaster runs colocated with the Next.js/Railway deployment or as a separate local process (likely the latter, since virtual MIDI ports and local audio software imply this runs on the installation machine, not in the cloud container).
- **Decision:** local process on the installation machine (`npm run broadcast`).

### Step 9: Signal Mapping Utilities — DONE (placeholder map)
- Implement MIDI CC scaling utilities: raw environmental values → integers 0–127.
- Implement OSC scaling utilities: raw values → normalized floats 0.0–1.0 for spatial panning/granular synth parameters.
- Define the mapping table (which `BosphorusState` field maps to which MIDI CC # / OSC address) — **decision needed, in collaboration with the installation's audio patch design**.
- Placeholder: `lib/osc-midi/mapping.ts`.

### Step 10: Signal Broadcasting Service — DONE (dry-run; live test pending)
- Build the broadcaster process that reads new `BosphorusState` rows (via Supabase Realtime or polling) and emits corresponding OSC/MIDI events continuously.
- Validate against real audio software (Ableton Live / Max/MSP / SuperCollider) in a live test.
- **Checkpoint:** live signal test and calibration session before considering Phase 3 complete.

---

## Cross-Cutting: Living Rules (SSOT)
- `.cursor/rules/*.md` will be revisited and refined non-destructively as each phase progresses or new requirements emerge, so future work always reflects the current state of truth.
- Any new architectural decision made during a checkpoint discussion gets folded back into the relevant rule file immediately after being finalized.

---

## Immediate Next Step
Provide Supabase credentials, apply the migration SQL, fill `.env.local`, then run `npm run worker` and open `/dashboard`.
