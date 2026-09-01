# Backend & API Integration Rules

## API Targets & Exact Data Mapping
The system must aggressively fetch, parse, and standardize data from the following specific sources:
1. Open-Meteo (Marine & Weather API): Extract wind speed, wave height, and sea surface temperature.
2. AISStream.io (WebSocket) / MarineTraffic: Extract real-time vessel traffic within a specific Bosphorus bounding box (target data: vessel count, vessel size/MMSI, precise coordinates).
3. Copernicus Marine (CMEMS) / EMODnet: Extract surface and deep current vectors (U and V components), salinity, and water density/pressure.

## Standardization & Fetching Strategy
- Create a strict standardizer function. All chaotic third-party JSON/NetCDF data must be transformed into a single, unified `BosphorusState` object before pushing to Supabase.
- Normalize numerical values where possible, keeping in mind that these values will eventually be mapped to audio parameters (e.g., mapping wind speeds to a 0.0 - 1.0 range).
- Handle API rate limits and connection drops gracefully. If an API fails, log the error and fallback to the last known state. The system must never crash due to a third-party timeout.

## Background Execution
- Data fetching must be handled via cron jobs or a background worker process. The database must update 24/7 independently of active UI sessions or frontend browser visits.

## Locked decisions
- Single Node worker process (`npm run worker`): REST pollers + one long-lived AIS WebSocket. Not a cron one-shot.
- CMEMS/EMODnet uses `CMEMS_ERDDAP_URL` JSON when configured; otherwise last-known-good / unavailable — never invent values.
- `BosphorusState` in `lib/standardize/types.ts` is the contract for dashboard and OSC/MIDI.