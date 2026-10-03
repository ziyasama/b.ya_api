import type { BosphorusState } from "@/lib/standardize/types";

/** Browser OSC goes to this machine only, on IPv4 and IPv6. The worker's stream stays on 57121. */
export const OSC_HOST = "127.0.0.1";
export const OSC_HOSTS = "127.0.0.1 and ::1";
export const OSC_PORT_MIN = 1024;
export const OSC_PORT_MAX = 65535;
export const OSC_SETTINGS_KEY = "bosphorus.osc-panel";

export type OscChannelKind = "level" | "bang";

/** Real-world span mapped onto one 14-bit MIDI CC. */
export type MidiRange = { min: number; max: number };

export type OscChannel = {
  id: string;
  group: "Wind" | "Waves & surface" | "Sea level" | "Traffic" | "Gates";
  label: string;
  address: string;
  defaultPort: number;
  unit: string;
  kind: OscChannelKind;
  /** MSB controller. The LSB is this plus 32, and it must stay in 0–31. */
  cc: number;
  /** Full scale for a level. Gates blip and have no range. */
  range: MidiRange | null;
};

/**
 * One UDP port per reading. Ports are editable; several rows may share one
 * for SuperCollider. Defaults start at 9101 so they do not collide with the
 * worker on 57121.
 *
 * `cc` is the MIDI MSB for the same row (LSB = cc + 32). `range` is the
 * real-world span for that 14-bit value: wind in m/s, direction in degrees,
 * and so on. Level spans match lib/standardize/ranges.ts. Black Sea is the
 * gauge anomaly against its own rolling mean, so it is signed and wider than
 * the head. Gates have no range.
 */
export const OSC_CHANNELS: OscChannel[] = [
  { id: "windSpeed", group: "Wind", label: "Wind", address: "/bosphorus/wind/speed", defaultPort: 9101, unit: "m/s", kind: "level", cc: 1, range: { min: 0, max: 25 } },
  { id: "windDirection", group: "Wind", label: "Wind dir", address: "/bosphorus/wind/direction", defaultPort: 9102, unit: "°", kind: "level", cc: 2, range: { min: 0, max: 360 } },
  { id: "waveHeight", group: "Waves & surface", label: "Wave", address: "/bosphorus/wave/height", defaultPort: 9103, unit: "m", kind: "level", cc: 3, range: { min: 0, max: 3 } },
  { id: "wavePeriod", group: "Waves & surface", label: "Wave period", address: "/bosphorus/wave/period", defaultPort: 9104, unit: "s", kind: "level", cc: 4, range: { min: 0, max: 9 } },
  { id: "swellHeight", group: "Waves & surface", label: "Swell", address: "/bosphorus/wave/swell", defaultPort: 9105, unit: "m", kind: "level", cc: 5, range: { min: 0, max: 3 } },
  { id: "seaSurfaceTemp", group: "Waves & surface", label: "Water temp", address: "/bosphorus/sea/temp", defaultPort: 9106, unit: "°C", kind: "level", cc: 6, range: { min: 6, max: 28 } },
  { id: "seaLevelHead", group: "Sea level", label: "Sea level head", address: "/bosphorus/sea/head", defaultPort: 9107, unit: "m", kind: "level", cc: 7, range: { min: -0.3, max: 0.3 } },
  { id: "seaLevelBlackSea", group: "Sea level", label: "Black Sea", address: "/bosphorus/sea/black", defaultPort: 9108, unit: "m", kind: "level", cc: 8, range: { min: -0.5, max: 0.5 } },
  { id: "vesselCount", group: "Traffic", label: "Vessels", address: "/bosphorus/vessels/count", defaultPort: 9109, unit: "", kind: "level", cc: 9, range: { min: 0, max: 80 } },
  { id: "northboundCount", group: "Traffic", label: "Northbound", address: "/bosphorus/vessels/northbound", defaultPort: 9110, unit: "", kind: "level", cc: 10, range: { min: 0, max: 80 } },
  { id: "southboundCount", group: "Traffic", label: "Southbound", address: "/bosphorus/vessels/southbound", defaultPort: 9111, unit: "", kind: "level", cc: 11, range: { min: 0, max: 80 } },
  { id: "gateNorth", group: "Gates", label: "North gate", address: "/bosphorus/event/gate/north", defaultPort: 9112, unit: "", kind: "bang", cc: 12, range: null },
  { id: "gateSouth", group: "Gates", label: "South gate", address: "/bosphorus/event/gate/south", defaultPort: 9113, unit: "", kind: "bang", cc: 13, range: null },
  { id: "gateAny", group: "Gates", label: "Any gate", address: "/bosphorus/event/gate", defaultPort: 9114, unit: "", kind: "bang", cc: 14, range: null },
];

const CHANNELS_BY_ID = new Map(OSC_CHANNELS.map((channel) => [channel.id, channel]));
const ADDRESSES = new Set(OSC_CHANNELS.map((channel) => channel.address));

export type OscChannelSetting = {
  osc: boolean;
  midi: boolean;
  port: number;
};

export type OscOutbound = {
  address: string;
  port: number;
  value: number;
};

export function oscChannel(id: string): OscChannel | undefined {
  return CHANNELS_BY_ID.get(id);
}

export function isOscAddress(address: string): boolean {
  return ADDRESSES.has(address);
}

export function isOscPort(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= OSC_PORT_MIN &&
    value <= OSC_PORT_MAX
  );
}

export function defaultOscSettings(): Record<string, OscChannelSetting> {
  return Object.fromEntries(
    OSC_CHANNELS.map((channel) => [
      channel.id,
      { osc: false, midi: false, port: channel.defaultPort },
    ]),
  );
}

/** Same number the matching dashboard card would show. Null means do not send. */
export function levelReading(state: BosphorusState | null, id: string): number | null {
  if (!state) return null;
  const value = reading(state, id);
  return value != null && Number.isFinite(value) ? value : null;
}

function reading(state: BosphorusState, id: string): number | null {
  switch (id) {
    case "windSpeed":
      return state.available.wind ? state.windSpeed : null;
    case "windDirection":
      return state.windDirection;
    case "waveHeight":
      return state.available.wave ? state.waveHeight : null;
    case "wavePeriod":
      return state.wavePeriod;
    case "swellHeight":
      return state.swellHeight;
    case "seaSurfaceTemp":
      return state.available.seaSurfaceTemp ? state.seaSurfaceTemp : null;
    case "seaLevelHead":
      return state.available.seaLevel ? state.seaLevelHead : null;
    case "seaLevelBlackSea":
      return state.seaLevelBlackSea;
    case "vesselCount":
      return state.available.vessels ? state.vesselCount : null;
    case "northboundCount":
      return state.available.vessels ? state.northboundCount : null;
    case "southboundCount":
      return state.available.vessels ? state.southboundCount : null;
    default:
      return null;
  }
}

export function formatOscReading(value: number | null, kind: OscChannelKind): string {
  if (kind === "bang") return "1";
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function levelMessages(
  state: BosphorusState | null,
  settings: Record<string, OscChannelSetting>,
): OscOutbound[] {
  const messages: OscOutbound[] = [];
  for (const channel of OSC_CHANNELS) {
    if (channel.kind !== "level") continue;
    const setting = settings[channel.id];
    if (!setting?.osc || !isOscPort(setting.port)) continue;
    const value = levelReading(state, channel.id);
    if (value == null) continue;
    messages.push({ address: channel.address, port: setting.port, value });
  }
  return messages;
}

/** Older saves used one `enabled` flag for both outputs. */
export function parseStoredChannel(row: unknown, defaultPort: number): OscChannelSetting {
  const record =
    row && typeof row === "object"
      ? (row as { enabled?: unknown; osc?: unknown; midi?: unknown; port?: unknown })
      : {};
  const legacy = record.enabled === true;
  return {
    osc: typeof record.osc === "boolean" ? record.osc : legacy,
    midi: typeof record.midi === "boolean" ? record.midi : legacy,
    port: isOscPort(record.port) ? record.port : defaultPort,
  };
}

export function readOscSettings(): Record<string, OscChannelSetting> {
  const settings = defaultOscSettings();
  if (typeof window === "undefined") return settings;
  try {
    const raw = window.localStorage.getItem(OSC_SETTINGS_KEY);
    if (!raw) return settings;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return settings;
    const stored = parsed as Record<string, unknown>;
    for (const channel of OSC_CHANNELS) {
      settings[channel.id] = parseStoredChannel(stored[channel.id], channel.defaultPort);
    }
  } catch {
    return settings;
  }
  return settings;
}

export function writeOscSettings(settings: Record<string, OscChannelSetting>): void {
  try {
    window.localStorage.setItem(OSC_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode and a full disk both leave the in-memory toggles working.
  }
}
