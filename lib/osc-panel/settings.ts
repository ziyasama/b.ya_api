import {
  defaultOscSettings,
  readOscSettings,
  writeOscSettings,
  type OscChannelSetting,
} from "@/lib/osc-panel/catalog";

const serverSettings = defaultOscSettings();
let snapshot = serverSettings;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeOscSettings(listener: () => void): () => void {
  listeners.add(listener);
  if (!hydrated && typeof window !== "undefined") {
    queueMicrotask(() => {
      if (hydrated) return;
      hydrated = true;
      snapshot = readOscSettings();
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getOscSettings(): Record<string, OscChannelSetting> {
  return snapshot;
}

export function getServerOscSettings(): Record<string, OscChannelSetting> {
  return serverSettings;
}

export function updateOscSettings(next: Record<string, OscChannelSetting>): void {
  snapshot = next;
  writeOscSettings(next);
  emit();
}

const TIME_MIDI_KEY = "bosphorus.time-midi";

let timeMidi = false;
let timeHydrated = false;
const timeListeners = new Set<() => void>();

function emitTime() {
  for (const listener of timeListeners) listener();
}

export function subscribeTimeMidi(listener: () => void): () => void {
  timeListeners.add(listener);
  if (!timeHydrated && typeof window !== "undefined") {
    queueMicrotask(() => {
      if (timeHydrated) return;
      timeHydrated = true;
      try {
        timeMidi = window.localStorage.getItem(TIME_MIDI_KEY) === "1";
      } catch {
        timeMidi = false;
      }
      emitTime();
    });
  }
  return () => {
    timeListeners.delete(listener);
  };
}

export function getTimeMidi(): boolean {
  return timeMidi;
}

export function getServerTimeMidi(): boolean {
  return false;
}

export function setTimeMidi(on: boolean): void {
  timeMidi = on;
  try {
    window.localStorage.setItem(TIME_MIDI_KEY, on ? "1" : "0");
  } catch {
    // Private mode still keeps the switch for this visit.
  }
  emitTime();
}
