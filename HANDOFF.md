# Agent handoff log

Use a **new agent chat per remaining checkpoint**. Read this file plus `PLAN.md` and only the rule files listed for that step.

## Defaults (locked)

- npm, Next.js App Router, TypeScript, Tailwind, no `src/`
- Panel: **public, no auth.** The password gate was removed in `061375d`
- Workers: one Node process (`npm run worker`)
- OSC/MIDI: local `npm run broadcast`
- Signal set: **wind, wave, current, water temperature, vessels.** Salinity and
  the ocean column were dropped in Sep 2026

---

## Step 11 — Source audit and rebuild — DONE, 2 Sep 2026

The dashboard was publishing numbers that were not true. Testing each source
against reality found:

- **Waves came from the wrong sea.** The marine wave model has no grid cell
  inside the Bosphorus, so the strait request snapped ~9 km south into the Sea
  of Marmara and returned 0.04 m at a 2-second period. Now sampled at the
  nearest real cell (41.375, 29.125) in open Black Sea water off the northern
  mouth, which reads 0.4 m at 4.25 s. `sample_lat`/`sample_lon` record the cell
  the API actually used so this cannot recur silently.
- **Model wind read about half the observed speed.** 2.97 m/s modelled against
  5.1–6.2 m/s at three Istanbul anemometers. Wind now prefers measured METAR
  (free, keyless) and falls back to the model, with `wind_source` naming which.
- **Current never had a source.** `current_u`/`current_v` were null in every
  row ever written, and `normalize()` maps null to 0, so a dead-calm strait was
  shown as fact. Replaced by measured sea level from IOC tide gauges at Şile
  (Black Sea) and Yalova (Marmara); the Black Sea minus Marmara head is what
  physically drives the surface flow. Gauges sit on differing local datums, so
  each is compared to its own 24 h mean and only anomalies are subtracted.
- **AIS worked but was forgetful.** The roster lived only in memory, so every
  restart reset the strait to empty while the worker persisted anyway. Now
  persisted to `vessel_positions` and rehydrated on boot; round-trip verified.

Migration `0002_measured_sources.sql` is **applied**. Verified end to end:
`persist.ok vesselCount:5 windSpeed:6.17 windSource:metar seaLevelHead:-0.019`.

Run `npm run check:sources` to see what every keyless source currently returns,
including how far the model snapped from the cell requested.

Honesty layer: `available` flags travel beside the values, `provenance` records
measured vs modelled and observation age per signal, and the broadcaster emits
`/bosphorus/available/*` as 0.0 or 1.0 so a patch can drop a voice rather than
read a normalized 0 as calm.

Retired: `lib/fetchers/cmems.ts`, `CmemsRaw`, and the Copernicus credentials in
`.env.local`. `cmems_mod_blk_phy-cur_anfc_mrm-500m_PT1H-i` is the validated
route back to a true in-strait velocity in m/s, at the cost of a Python sidecar.

---

## Step 1 — Scaffolding — DONE

Next.js 16 App Router + Tailwind at repo root. Folders: `app/`, `components/`, `lib/`, `workers/`, `lib/standardize/`, `lib/osc-midi/`. `.env.example` and `.gitignore` (`.env.local` excluded). `npm run build` / `npm start` present.

## Step 2 — Supabase + panel gate — DONE (migrations 0001 and 0002 applied)

DDL: `supabase/migrations/`. Admin client: `lib/supabase/admin.ts` (never from
`"use client"`). The password gate and `/login` were removed in `061375d`, so
the dashboard is public. Reads are public too: the RLS policy is `using (true)`.

## Step 3 — Fetchers — DONE, rebuilt in Step 11

Contracts in `lib/fetchers/types.ts` and `lib/fetchers/README.md`, which
documents each source grouped by measured versus modelled. METAR and IOC sea
level need no keys; only AISStream does, and it works.

## Step 4 — Standardizer — DONE

`toBosphorusState` + `persistState`. Type: `lib/standardize/types.ts`. Raw + `normalized` 0–1 map.

## Step 5 — Worker — DONE

`npm run worker` → `workers/index.ts`. Topology: single process. Split Railway worker service only if the web dyno cannot stay alive.

## Step 6 — Dashboard — DONE

`/dashboard` mobile-first, dark cyan/gold, Realtime via `DashboardLive`.

## Step 7 — Railway — worker rides the existing web service

No second Railway service. Hobby cannot isolate this project from the rest of
the workspace, so the collector starts beside Next.js via `npm run hub`
(`workers/hub.ts`). `railway.json` pins **one replica** and zero deploy
overlap. Needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`AISSTREAM_API_KEY` on the existing service. Success: laptop closed,
`created_at` still advancing.

## Step 8 — OSC/MIDI scaffold — DONE

`lib/osc-midi` + `osc.js` / `easymidi` (optional). Env: `OSC_HOST`, `OSC_PORT`.

## Step 9 — Mapping — DONE (placeholders)

`lib/osc-midi/mapping.ts` and `scale.ts`. Confirm CC numbers with the audio patch.

## Step 10 — Broadcaster — DONE (dry-run default)

`npm run broadcast`. `OSC_MIDI_DRY_RUN=true` logs instead of opening ports. Live Ableton/Max/SuperCollider calibration still outstanding.

## Step 12 — Vessel events — DONE, 2 Sep 2026

Transit direction is the ship's course over ground while it is making 3
knots or more (heading if course is missing; a latitude step only when both
are absent). An underway fix is carried forward on that course for the
6-hour count window, and a ship that has entered stays inside until that
window ends, because the middle of the strait goes quiet and the last point
sits at the mouth. Gate crossings are intersections
with the Port of Istanbul lighthouse lines: Rumeli–Anadolu (north) and
Ahırkapı–İnciburnu (south). Written to `vessel_events`. Jitter and AIS gaps
longer than 15 minutes are not events.

Migration `0003_vessel_events.sql` is **applied**.

## Step 13 — Radio + composer slot — BUILT, run locally

`radio/` Docker image: JACK dummy, SuperCollider, ffmpeg 96 kbps MP3, Icecast.
Hot-reloadable patch at `radio/patch/live.scd`. Contract:
`docs/SIGNAL_CONTRACT.md`. Not deployed to Railway (Hobby workspace).
`docker compose -f radio/docker-compose.yml up --build` after inventing the
two Icecast passwords in `.env.local`.
