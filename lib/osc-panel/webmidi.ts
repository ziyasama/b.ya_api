import {
  cc7Message,
  cc14Messages,
  MIDI_SYNC_GAP_MS,
} from "@/lib/osc-panel/midi";

export type MidiStatus =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "unsupported" }
  | { state: "denied"; message: string }
  | { state: "no-output"; names: string[] }
  | { state: "ready"; name: string };

const IDLE: MidiStatus = { state: "idle" };
const CONNECTING: MidiStatus = { state: "connecting" };
const UNSUPPORTED: MidiStatus = { state: "unsupported" };
const NO_OUTPUT_EMPTY: MidiStatus = { state: "no-output", names: [] };

let access: MIDIAccess | null = null;
let output: MIDIOutput | null = null;
let status: MidiStatus = IDLE;
let connecting: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function sameStatus(a: MidiStatus, b: MidiStatus): boolean {
  if (a.state !== b.state) return false;
  if (a.state === "ready" && b.state === "ready") return a.name === b.name;
  if (a.state === "denied" && b.state === "denied") return a.message === b.message;
  if (a.state === "no-output" && b.state === "no-output") {
    return a.names.join("\0") === b.names.join("\0");
  }
  return true;
}

function setStatus(next: MidiStatus) {
  if (sameStatus(status, next)) return;
  status = next;
  emit();
}

export function getMidiStatus(): MidiStatus {
  return status;
}

export function getServerMidiStatus(): MidiStatus {
  return IDLE;
}

export function subscribeMidi(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function connectedOutputs(midi: MIDIAccess): MIDIOutput[] {
  return [...midi.outputs.values()].filter((port) => port.state === "connected");
}

function iacOutput(midi: MIDIAccess): MIDIOutput | null {
  const ports = connectedOutputs(midi).filter((port) => /iac/i.test(port.name ?? ""));
  return ports.find((port) => /bus\s*1/i.test(port.name ?? "")) ?? ports[0] ?? null;
}

function bind(midi: MIDIAccess) {
  output = iacOutput(midi);
  if (!output) {
    const names = connectedOutputs(midi)
      .map((port) => port.name || "Unnamed")
      .sort();
    setStatus(names.length === 0 ? NO_OUTPUT_EMPTY : { state: "no-output", names });
    return;
  }
  setStatus({ state: "ready", name: output.name || "IAC Driver" });
}

export function connectMidi(): Promise<void> {
  if (typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function") {
    setStatus(UNSUPPORTED);
    return Promise.resolve();
  }
  if (access) {
    bind(access);
    return Promise.resolve();
  }
  if (connecting) return connecting;
  setStatus(CONNECTING);
  connecting = navigator
    .requestMIDIAccess()
    .then((midi) => {
      access = midi;
      midi.onstatechange = () => {
        if (access) bind(access);
      };
      bind(midi);
    })
    .catch((error: unknown) => {
      access = null;
      const message = error instanceof Error ? error.message : "MIDI permission denied";
      setStatus({ state: "denied", message });
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

function transmit(bytes: number[]) {
  const port = output;
  if (!port) return;
  try {
    port.send(bytes);
  } catch {
    output = null;
    if (access) bind(access);
    else setStatus(NO_OUTPUT_EMPTY);
  }
}

export function sendCc7(cc: number, value: number) {
  if (status.state !== "ready") return;
  transmit(cc7Message(cc, value));
}

export function sendCc14(cc: number, word: number) {
  if (status.state !== "ready") return;
  for (const message of cc14Messages(cc, word)) transmit(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** One CC pair at a time. A single burst is easy for Live to drop on session load. */
export async function sendCc14Sequence(
  words: ReadonlyArray<{ cc: number; word: number }>,
): Promise<number> {
  let sent = 0;
  for (const { cc, word } of words) {
    if (status.state !== "ready") break;
    sendCc14(cc, word);
    sent += 1;
    if (sent < words.length) await wait(MIDI_SYNC_GAP_MS);
  }
  return sent;
}
