/**
 * Environment accessors. Missing values return empty string so fetchers can
 * fall back instead of crashing the process.
 */

export function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * A ship stays in the vessel count for this long after its last AIS position.
 * Daytime traffic is still in the strait well after the radio drops out in
 * the middle, so four hours was erasing ships a person could see.
 */
export const VESSEL_COUNT_WINDOW_MS = 6 * 60 * 60 * 1000;

export function vesselCountWindowMs(): number {
  return envNumber("AIS_STALE_MS", VESSEL_COUNT_WINDOW_MS);
}

/** "Last 6 hours" — the span named on the traffic rows. */
export function vesselCountWindowLabel(ms = vesselCountWindowMs()): string {
  if (ms % 3_600_000 === 0) {
    const hours = ms / 3_600_000;
    return hours === 1 ? "Last hour" : `Last ${hours} hours`;
  }
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return minutes === 1 ? "Last minute" : `Last ${minutes} min`;
  }
  const seconds = Math.round(ms / 1000);
  return seconds === 1 ? "Last second" : `Last ${seconds} s`;
}

export function cartoApiKey(): string {
  return env("NEXT_PUBLIC_CARTO_API_KEY");
}

/** Local Icecast mount. Radio is not on Railway; this is the machine running compose. */
export function radioStreamUrl(): string {
  return env("NEXT_PUBLIC_RADIO_URL", "http://localhost:8000/bosphorus");
}

export const BOSPHORUS = {
  lat: () => envNumber("BOSPHORUS_LAT", 41.04),
  lon: () => envNumber("BOSPHORUS_LON", 29.01),
  // Wave and SST sample point, deliberately NOT the strait. The marine wave
  // model has no cell inside the Bosphorus (700 m to 3.5 km wide), so a strait
  // request silently snaps ~9 km south into the Sea of Marmara and returns an
  // inshore near-zero. These are the coordinates of the nearest cell the model
  // genuinely has, in open Black Sea water off the northern mouth — the water
  // that then flows south through the strait. Naming the cell centre rather
  // than an approximation keeps the reported displacement near zero, so the
  // check in scripts/check-sources.ts stays meaningful. Verified 2 Sep 2026.
  waveLat: () => envNumber("BOSPHORUS_WAVE_LAT", 41.375),
  waveLon: () => envNumber("BOSPHORUS_WAVE_LON", 29.125),
  latMin: () => envNumber("BOSPHORUS_LAT_MIN", 40.99),
  latMax: () => envNumber("BOSPHORUS_LAT_MAX", 41.24),
  lonMin: () => envNumber("BOSPHORUS_LON_MIN", 28.95),
  lonMax: () => envNumber("BOSPHORUS_LON_MAX", 29.15),
  // Wider AIS box: Sea of Marmara -> strait -> Black Sea approaches.
  // This is the box Open Waters is asked for (lib/fetchers/openwaters.ts).
  // The strait box sits inside it.
  approachLatMin: () => envNumber("BOSPHORUS_APPROACH_LAT_MIN", 40.85),
  approachLatMax: () => envNumber("BOSPHORUS_APPROACH_LAT_MAX", 41.4),
  approachLonMin: () => envNumber("BOSPHORUS_APPROACH_LON_MIN", 28.7),
  approachLonMax: () => envNumber("BOSPHORUS_APPROACH_LON_MAX", 29.4),
};

/**
 * Airport anemometers reporting METAR near the strait. Real measurements,
 * 15 to 25 km inland, which still beats a model that reported half the
 * observed speed at the strait point on 2 Sep 2026.
 */
export const METAR_STATIONS = (): string[] =>
  env("METAR_STATIONS", "LTFM,LTBA,LTFJ")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

/**
 * IOC Sea Level Monitoring station codes on either side of the strait. The
 * Black Sea minus Marmara head is what physically drives the surface flow.
 * `ista` sits inside the strait but stopped reporting 17 Aug 2026; `igne` and
 * `maer` are the further-out backups.
 */
export const SEA_LEVEL = {
  blackSea: () => env("SEA_LEVEL_BLACK_SEA_CODE", "sile"),
  marmara: () => env("SEA_LEVEL_MARMARA_CODE", "yalo"),
  blackSeaBackup: () => env("SEA_LEVEL_BLACK_SEA_BACKUP", "igne"),
  marmaraBackup: () => env("SEA_LEVEL_MARMARA_BACKUP", "maer"),
  /** Hours of history used as each station's own datum, since gauges sit on differing local datums. */
  baselineHours: () => envNumber("SEA_LEVEL_BASELINE_HOURS", 24),
};
