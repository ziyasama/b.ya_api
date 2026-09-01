/**
 * Physical ranges used to map raw Bosphorus values into 0.0–1.0 for OSC
 * and (via scaleMidiCc) 0–127 for MIDI. Tune at the Step 9 checkpoint.
 */
export const RANGES = {
  windSpeed: { min: 0, max: 25 },
  waveHeight: { min: 0, max: 4 },
  seaSurfaceTemp: { min: 5, max: 30 },
  currentDirection: { min: 0, max: 360 },
  currentSpeed: { min: 0, max: 3 },
  currentU: { min: -2, max: 2 },
  currentV: { min: -2, max: 2 },
  salinity: { min: 10, max: 40 },
  waterDensity: { min: 1010, max: 1030 },
  vesselCount: { min: 0, max: 80 },
} as const;

export type RangeKey = keyof typeof RANGES;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalize(value: number | null | undefined, key: RangeKey): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const { min, max } = RANGES[key];
  return clamp01((value - min) / (max - min));
}

export function currentSpeedMs(u: number | null, v: number | null): number | null {
  if (u == null || v == null) return null;
  return Math.hypot(u, v);
}

/** Oceanographic convention: direction the current flows toward, degrees from north. */
export function currentDirectionDeg(u: number | null, v: number | null): number | null {
  if (u == null || v == null) return null;
  const deg = (Math.atan2(u, v) * 180) / Math.PI;
  return (deg + 360) % 360;
}
