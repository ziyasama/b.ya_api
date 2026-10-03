import {
  levelReading,
  oscChannel,
  OSC_CHANNELS,
  type MidiRange,
  type OscChannel,
  type OscChannelSetting,
} from "@/lib/osc-panel/catalog";
import type { BosphorusState } from "@/lib/standardize/types";

/** 14-bit CC word. MSB is bits 13–7, LSB is bits 6–0. */
export const MIDI_14BIT_MAX = 16383;

/** Live shows channel 1. The status byte uses the zero-based nibble. */
export const MIDI_CHANNEL = 0;

/** 7-bit CC. Time of day uses this; the environmental rows stay 14-bit. */
export const MIDI_7BIT_MAX = 127;

/**
 * Plain CC for the local time of day. Sits after the level MSBs (CC 1–11)
 * and outside their fine bytes (CC 33–43), so Live can map it on its own.
 */
export const TIME_CC = 15;

/**
 * Plain CC for the day part. The value is the Live chain position
 * (4, 8, 10, 18, 23, 46), so this controller stays off the fine-byte range.
 */
export const DAY_PART_CC = 16;

export type DayPart = {
  id: string;
  label: string;
  mode: string;
  /** Inclusive start, in minutes from local midnight. */
  startMinute: number;
  /** Exclusive end. Values past 24:00 wrap into the next morning. */
  endMinute: number;
  value: number;
};

/**
 * Six covers of the local day, in the same order as the Live chains:
 * Major, Minor, Dorian, Lydian, Phrygian, *Phrygian.
 * Midnight runs through 01:00, then Night until sunrise.
 */
export const DAY_PARTS: DayPart[] = [
  { id: "sunrise", label: "Sunrise", mode: "Major", startMinute: 5 * 60, endMinute: 9 * 60, value: 4 },
  { id: "noon", label: "Noon", mode: "Minor", startMinute: 9 * 60, endMinute: 13 * 60, value: 8 },
  { id: "afternoon", label: "Afternoon", mode: "Dorian", startMinute: 13 * 60, endMinute: 17 * 60, value: 10 },
  { id: "evening", label: "Evening", mode: "Lydian", startMinute: 17 * 60, endMinute: 21 * 60, value: 18 },
  { id: "midnight", label: "Midnight", mode: "Phrygian", startMinute: 21 * 60, endMinute: 25 * 60, value: 23 },
  { id: "night", label: "Night", mode: "*Phrygian", startMinute: 1 * 60, endMinute: 5 * 60, value: 46 },
];

/** Pause between CC pairs so Live can apply each mapped control in a dump. */
export const MIDI_SYNC_GAP_MS = 20;

export type MidiWord = { cc: number; word: number };

export type MidiLevel = { id: string; cc: number; word: number };

export function scaleToMidi14(value: number, range: MidiRange): number {
  if (!Number.isFinite(value) || !(range.max > range.min)) return 0;
  const unit = (value - range.min) / (range.max - range.min);
  const clamped = Math.min(1, Math.max(0, unit));
  return Math.round(clamped * MIDI_14BIT_MAX);
}

/** One 7-bit CC. No fine byte. */
export function cc7Message(cc: number, value: number): number[] {
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
    throw new Error(`CC ${cc} is outside 0–127`);
  }
  const clipped = Math.min(MIDI_7BIT_MAX, Math.max(0, Math.round(value)));
  const status = 0xb0 | (MIDI_CHANNEL & 0x0f);
  return [status, cc, clipped];
}

/**
 * Local time across one day. Midnight is 0, the last moment of the day is 127.
 * Each step is about eleven minutes.
 */
export function timeOfDayCc(date: Date): number {
  const minutes =
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000;
  const unit = minutes / (24 * 60);
  return Math.min(MIDI_7BIT_MAX, Math.max(0, Math.round(unit * MIDI_7BIT_MAX)));
}

/** Which named part of the local day this clock time falls in. */
export function dayPartAt(date: Date): DayPart {
  const minute = date.getHours() * 60 + date.getMinutes();
  const found = DAY_PARTS.find((part) => {
    if (part.endMinute <= 24 * 60) return minute >= part.startMinute && minute < part.endMinute;
    return minute >= part.startMinute || minute < part.endMinute - 24 * 60;
  });
  return found ?? DAY_PARTS[0];
}

/**
 * LSB on CC n+32, then MSB on CC n. A 14-bit receiver applies the pair when
 * the MSB arrives. Map the MSB in Live.
 */
export function cc14Messages(cc: number, word: number): [number[], number[]] {
  if (!Number.isInteger(cc) || cc < 0 || cc > 31) {
    throw new Error(`MSB CC ${cc} is outside 0–31`);
  }
  const clipped = Math.min(MIDI_14BIT_MAX, Math.max(0, Math.round(word)));
  const msb = (clipped >> 7) & 0x7f;
  const lsb = clipped & 0x7f;
  const status = 0xb0 | (MIDI_CHANNEL & 0x0f);
  return [
    [status, cc + 32, lsb],
    [status, cc, msb],
  ];
}

export function formatMidiCc(channel: OscChannel): string {
  return `CC ${channel.cc} + ${channel.cc + 32}`;
}

export function formatMidiRange(channel: OscChannel): string {
  const { min, max } = channel.range;
  const span = `${min} to ${max}`;
  return channel.unit ? `${span} ${channel.unit}` : span;
}

export function midiWord(channel: OscChannel, value: number | null): number | null {
  if (channel.kind !== "level" || !channel.range || value == null) return null;
  return scaleToMidi14(value, channel.range);
}

/** Levels whose MIDI switch is on, scaled to 14-bit. Skips a missing reading. */
export function enabledMidiLevels(
  state: BosphorusState | null,
  settings: Record<string, OscChannelSetting>,
): MidiWord[] {
  const words: MidiWord[] = [];
  for (const channel of OSC_CHANNELS) {
    if (channel.kind !== "level" || !channel.range) continue;
    if (!settings[channel.id]?.midi) continue;
    const value = levelReading(state, channel.id);
    if (value == null) continue;
    words.push({ cc: channel.cc, word: scaleToMidi14(value, channel.range) });
  }
  return words;
}

/**
 * Every level that currently has a reading. The Sync button uses this to
 * prime a Live set that is already mapped, including rows whose MIDI switch
 * is still off.
 */
export function snapshotMidiLevels(state: BosphorusState | null): MidiLevel[] {
  const levels: MidiLevel[] = [];
  for (const channel of OSC_CHANNELS) {
    if (channel.kind !== "level" || !channel.range) continue;
    const value = levelReading(state, channel.id);
    if (value == null) continue;
    levels.push({
      id: channel.id,
      cc: channel.cc,
      word: scaleToMidi14(value, channel.range),
    });
  }
  return levels;
}

/**
 * Turn MIDI on for the levels just sent, so the next compiled snapshot keeps
 * updating Live. Returns null when those rows are already on.
 */
export function withLevelMidiOn(
  settings: Record<string, OscChannelSetting>,
  ids: readonly string[],
): Record<string, OscChannelSetting> | null {
  let changed = false;
  const next: Record<string, OscChannelSetting> = { ...settings };
  for (const id of ids) {
    const channel = oscChannel(id);
    if (!channel || channel.kind !== "level") continue;
    const row = next[id];
    if (!row || row.midi) continue;
    next[id] = { ...row, midi: true };
    changed = true;
  }
  return changed ? next : null;
}
