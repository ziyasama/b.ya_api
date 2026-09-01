import { clamp01 } from "@/lib/standardize/ranges";

/** Raw or already-normalized 0–1 value → MIDI CC integer 0–127. */
export function scaleMidiCc(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(clamp01(value) * 127);
}

/** Raw or already-normalized value → OSC float 0.0–1.0. */
export function scaleOsc(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return clamp01(value);
}
