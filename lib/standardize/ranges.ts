/**
 * Physical ranges used to map raw Bosphorus values into 0.0–1.0 for OSC
 * and (via scaleMidiCc) 0–127 for MIDI.
 *
 * Wave bounds are for the open-water cell at the northern mouth, which reads
 * roughly ten times higher than the displaced inshore cell the pipeline used
 * before. Sea level head is signed, so 0 m maps to 0.5.
 */
export const RANGES = {
  windSpeed: { min: 0, max: 25 },
  windDirection: { min: 0, max: 360 },
  waveHeight: { min: 0, max: 3 },
  wavePeriod: { min: 0, max: 9 },
  swellHeight: { min: 0, max: 3 },
  // Black Sea surface off the northern mouth: roughly 7 C in late winter,
  // 25 C measured on 2 Sep 2026, with late-August peaks nearer 28.
  seaSurfaceTemp: { min: 6, max: 28 },
  seaLevelHead: { min: -0.3, max: 0.3 },
  vesselCount: { min: 0, max: 80 },
  northboundCount: { min: 0, max: 80 },
  southboundCount: { min: 0, max: 80 },

  // Retired with the CMEMS ocean column. Always 0 for new rows.
  currentDirection: { min: 0, max: 360 },
  currentSpeed: { min: 0, max: 3 },
  currentU: { min: -2, max: 2 },
  currentV: { min: -2, max: 2 },
  salinity: { min: 10, max: 40 },
  waterDensity: { min: 1010, max: 1030 },
} as const;

export type RangeKey = keyof typeof RANGES;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * A missing value still collapses to 0, because OSC and MIDI have no way to
 * send "absent". The `available` flags on BosphorusState carry that fact
 * separately, so a consumer can drop a voice instead of reading 0 as calm.
 */
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
