import type { BosphorusNormalized } from "@/lib/standardize/types";

export type MappingTarget = {
  field: keyof BosphorusNormalized;
  oscAddress: string;
  midiCc: number;
  midiChannel: number;
};

/**
 * Default BosphorusState.normalized field → OSC address / MIDI CC.
 * Replace placeholders after the installation audio-patch review (Step 9).
 */
export const SIGNAL_MAP: MappingTarget[] = [
  { field: "windSpeed", oscAddress: "/bosphorus/wind/speed", midiCc: 1, midiChannel: 0 },
  { field: "waveHeight", oscAddress: "/bosphorus/wave/height", midiCc: 2, midiChannel: 0 },
  { field: "seaSurfaceTemp", oscAddress: "/bosphorus/sea/temp", midiCc: 3, midiChannel: 0 },
  { field: "currentSpeed", oscAddress: "/bosphorus/current/speed", midiCc: 4, midiChannel: 0 },
  { field: "currentDirection", oscAddress: "/bosphorus/current/direction", midiCc: 5, midiChannel: 0 },
  { field: "currentU", oscAddress: "/bosphorus/current/u", midiCc: 6, midiChannel: 0 },
  { field: "currentV", oscAddress: "/bosphorus/current/v", midiCc: 7, midiChannel: 0 },
  { field: "salinity", oscAddress: "/bosphorus/sea/salinity", midiCc: 8, midiChannel: 0 },
  { field: "waterDensity", oscAddress: "/bosphorus/sea/density", midiCc: 9, midiChannel: 0 },
  { field: "vesselCount", oscAddress: "/bosphorus/vessels/count", midiCc: 10, midiChannel: 0 },
];
