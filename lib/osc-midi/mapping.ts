import type { BosphorusNormalized } from "@/lib/standardize/types";

export type MappingTarget = {
  field: keyof BosphorusNormalized;
  oscAddress: string;
  midiCc: number;
  midiChannel: number;
};

/**
 * Default BosphorusState.normalized field → OSC address / MIDI CC.
 *
 * Sea level head replaces the current velocities: it is measured rather than
 * modelled, and it is the quantity that drives the strait's surface flow.
 * Being signed, it sits at 0.5 when the two seas are level.
 */
export const SIGNAL_MAP: MappingTarget[] = [
  { field: "windSpeed", oscAddress: "/bosphorus/wind/speed", midiCc: 1, midiChannel: 0 },
  { field: "windDirection", oscAddress: "/bosphorus/wind/direction", midiCc: 2, midiChannel: 0 },
  { field: "waveHeight", oscAddress: "/bosphorus/wave/height", midiCc: 3, midiChannel: 0 },
  { field: "wavePeriod", oscAddress: "/bosphorus/wave/period", midiCc: 4, midiChannel: 0 },
  { field: "swellHeight", oscAddress: "/bosphorus/wave/swell", midiCc: 5, midiChannel: 0 },
  { field: "seaSurfaceTemp", oscAddress: "/bosphorus/sea/temp", midiCc: 6, midiChannel: 0 },
  { field: "seaLevelHead", oscAddress: "/bosphorus/sea/head", midiCc: 7, midiChannel: 0 },
  { field: "vesselCount", oscAddress: "/bosphorus/vessels/count", midiCc: 8, midiChannel: 0 },
  { field: "northboundCount", oscAddress: "/bosphorus/vessels/northbound", midiCc: 9, midiChannel: 0 },
  { field: "southboundCount", oscAddress: "/bosphorus/vessels/southbound", midiCc: 10, midiChannel: 0 },
];

/** Gate crossing bangs. Sent as 1.0 at the moment of crossing, not as a level. */
export const GATE_EVENT_OSC = {
  north: "/bosphorus/event/gate/north",
  south: "/bosphorus/event/gate/south",
  any: "/bosphorus/event/gate",
} as const;

/** Availability flag → OSC address, sent as 0.0 or 1.0 so a patch can drop a voice. */
export const AVAILABILITY_MAP: Array<{ field: string; oscAddress: string }> = [
  { field: "wind", oscAddress: "/bosphorus/available/wind" },
  { field: "wave", oscAddress: "/bosphorus/available/wave" },
  { field: "seaSurfaceTemp", oscAddress: "/bosphorus/available/temp" },
  { field: "seaLevel", oscAddress: "/bosphorus/available/head" },
  { field: "vessels", oscAddress: "/bosphorus/available/vessels" },
];
