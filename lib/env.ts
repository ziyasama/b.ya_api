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

export const BOSPHORUS = {
  lat: () => envNumber("BOSPHORUS_LAT", 41.04),
  lon: () => envNumber("BOSPHORUS_LON", 29.01),
  latMin: () => envNumber("BOSPHORUS_LAT_MIN", 40.99),
  latMax: () => envNumber("BOSPHORUS_LAT_MAX", 41.24),
  lonMin: () => envNumber("BOSPHORUS_LON_MIN", 28.95),
  lonMax: () => envNumber("BOSPHORUS_LON_MAX", 29.15),
};
