import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultOscSettings,
  levelMessages,
  OSC_CHANNELS,
  parseStoredChannel,
} from "@/lib/osc-panel/catalog";
import {
  cc7Message,
  cc14Messages,
  enabledGateCc,
  enabledMidiLevels,
  MIDI_14BIT_MAX,
  MIDI_7BIT_MAX,
  MIDI_GATE_BLIP_MS,
  MIDI_SYNC_GAP_MS,
  scaleToMidi14,
  DAY_PART_CC,
  DAY_PARTS,
  dayPartAt,
  snapshotMidiLevels,
  TIME_CC,
  timeOfDayCc,
  withLevelMidiOn,
} from "@/lib/osc-panel/midi";
import type { BosphorusState } from "@/lib/standardize/types";

function channel(id: string) {
  const found = OSC_CHANNELS.find((row) => row.id === id);
  assert.ok(found, id);
  return found;
}

function windState(speed: number | null, available = true): BosphorusState {
  return {
    windSpeed: speed,
    available: {
      wind: available,
      wave: false,
      seaSurfaceTemp: false,
      seaLevel: false,
      vessels: false,
    },
  } as BosphorusState;
}

describe("MIDI catalog", () => {
  it("assigns a unique MSB in 1–14 so the LSB stays in the 14-bit pair", () => {
    const ccs = OSC_CHANNELS.map((row) => row.cc);
    assert.deepEqual(ccs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    assert.equal(new Set(ccs).size, ccs.length);
    for (const row of OSC_CHANNELS) {
      assert.ok(row.cc >= 0 && row.cc <= 31);
      if (row.kind === "level") {
        assert.ok(row.range && row.range.max > row.range.min);
      } else {
        assert.equal(row.range, null);
      }
    }
  });
});

describe("scaleToMidi14", () => {
  it("maps each end of a range and keeps a signed zero at mid scale", () => {
    const wind = channel("windSpeed");
    const head = channel("seaLevelHead");
    assert.equal(scaleToMidi14(0, wind.range!), 0);
    assert.equal(scaleToMidi14(25, wind.range!), MIDI_14BIT_MAX);
    assert.equal(scaleToMidi14(12.5, wind.range!), 8192);
    assert.equal(scaleToMidi14(0, head.range!), 8192);
    assert.equal(scaleToMidi14(-0.3, head.range!), 0);
    assert.equal(scaleToMidi14(0.3, head.range!), MIDI_14BIT_MAX);
  });

  it("clamps a raw wind speed instead of pinning it at full scale", () => {
    const wind = channel("windSpeed");
    assert.equal(scaleToMidi14(6.17, wind.range!), 4043);
    assert.equal(scaleToMidi14(40, wind.range!), MIDI_14BIT_MAX);
    assert.equal(scaleToMidi14(-2, wind.range!), 0);
  });

  it("maps direction in degrees across the circle", () => {
    const direction = channel("windDirection");
    assert.equal(scaleToMidi14(0, direction.range!), 0);
    assert.equal(scaleToMidi14(180, direction.range!), 8192);
    assert.equal(scaleToMidi14(360, direction.range!), MIDI_14BIT_MAX);
  });
});

describe("time of day", () => {
  it("uses a plain CC outside the 14-bit pairs", () => {
    const used = new Set<number>();
    for (const row of OSC_CHANNELS) {
      used.add(row.cc);
      used.add(row.cc + 32);
    }
    assert.equal(used.has(TIME_CC), false);
    assert.equal(used.has(DAY_PART_CC), false);
    assert.ok(TIME_CC >= 0 && TIME_CC <= 127);
  });

  it("gives each part of the day the Live chain value, in chain order", () => {
    assert.deepEqual(
      DAY_PARTS.map((part) => [part.label, part.mode, part.value]),
      [
        ["Sunrise", "Major", 4],
        ["Noon", "Minor", 8],
        ["Afternoon", "Dorian", 10],
        ["Evening", "Lydian", 18],
        ["Midnight", "Phrygian", 23],
        ["Night", "*Phrygian", 46],
      ],
    );
    const at = (hour: number, minute = 0) => dayPartAt(new Date(2026, 9, 3, hour, minute)).id;
    assert.equal(at(5), "sunrise");
    assert.equal(at(8, 59), "sunrise");
    assert.equal(at(9), "noon");
    assert.equal(at(12, 59), "noon");
    assert.equal(at(13), "afternoon");
    assert.equal(at(17), "evening");
    assert.equal(at(20, 59), "evening");
    assert.equal(at(21), "midnight");
    assert.equal(at(0), "midnight");
    assert.equal(at(0, 59), "midnight");
    assert.equal(at(1), "night");
    assert.equal(at(4, 59), "night");
    assert.deepEqual(cc7Message(DAY_PART_CC, 46), [0xb0, DAY_PART_CC, 46]);
  });

  it("maps midnight, noon, and the end of the day onto 0–127", () => {
    assert.equal(timeOfDayCc(new Date(2026, 9, 3, 0, 0, 0)), 0);
    assert.equal(timeOfDayCc(new Date(2026, 9, 3, 12, 0, 0)), 64);
    assert.equal(timeOfDayCc(new Date(2026, 9, 3, 23, 59, 0)), MIDI_7BIT_MAX);
    assert.deepEqual(cc7Message(TIME_CC, 64), [0xb0, TIME_CC, 64]);
  });
});

describe("cc14Messages", () => {
  it("sends the low byte on CC n+32 before the high byte on CC n", () => {
    assert.deepEqual(cc14Messages(1, 8192), [
      [0xb0, 33, 0],
      [0xb0, 1, 64],
    ]);
    assert.deepEqual(cc14Messages(12, MIDI_14BIT_MAX), [
      [0xb0, 44, 127],
      [0xb0, 12, 127],
    ]);
    assert.deepEqual(cc14Messages(1, 4043), [
      [0xb0, 33, 75],
      [0xb0, 1, 31],
    ]);
  });

  it("keeps a gate blip short", () => {
    assert.ok(MIDI_GATE_BLIP_MS > 0 && MIDI_GATE_BLIP_MS <= 200);
  });
});

describe("enabled rows", () => {
  it("follows the MIDI switch and skips a missing reading", () => {
    const settings = defaultOscSettings();
    settings.windSpeed = { ...settings.windSpeed, midi: true };
    assert.deepEqual(enabledMidiLevels(windState(6.17), settings), [{ cc: 1, word: 4043 }]);
    assert.deepEqual(enabledMidiLevels(windState(null), settings), []);
    assert.deepEqual(enabledMidiLevels(windState(6.17, false), settings), []);
    settings.windSpeed = { ...settings.windSpeed, midi: false };
    assert.deepEqual(enabledMidiLevels(windState(6.17), settings), []);
  });

  it("keeps OSC and MIDI switches independent", () => {
    const settings = defaultOscSettings();
    settings.windSpeed = { ...settings.windSpeed, osc: true, midi: false };
    assert.equal(levelMessages(windState(6.17), settings).length, 1);
    assert.deepEqual(enabledMidiLevels(windState(6.17), settings), []);
    settings.windSpeed = { ...settings.windSpeed, osc: false, midi: true, port: 0 };
    assert.equal(levelMessages(windState(6.17), settings).length, 0);
    assert.deepEqual(enabledMidiLevels(windState(6.17), settings), [{ cc: 1, word: 4043 }]);
  });

  it("blips only a gate whose MIDI switch is on", () => {
    const settings = defaultOscSettings();
    assert.equal(enabledGateCc("gateNorth", settings), null);
    settings.gateNorth = { ...settings.gateNorth, osc: true };
    assert.equal(enabledGateCc("gateNorth", settings), null);
    settings.gateNorth = { ...settings.gateNorth, midi: true };
    assert.equal(enabledGateCc("gateNorth", settings), 12);
    assert.equal(enabledGateCc("windSpeed", settings), null);
  });

  it("primes every level that has a reading and leaves gates out", () => {
    const state = {
      windSpeed: 6.17,
      windDirection: 180,
      waveHeight: null,
      available: {
        wind: true,
        wave: true,
        seaSurfaceTemp: false,
        seaLevel: false,
        vessels: false,
      },
    } as BosphorusState;
    const levels = snapshotMidiLevels(state);
    assert.deepEqual(
      levels.map((level) => level.cc),
      [1, 2],
    );
    assert.equal(levels[0]?.word, 4043);
    assert.equal(levels[1]?.word, 8192);
    assert.equal(snapshotMidiLevels(null).length, 0);
  });

  it("arms only the levels that were sent", () => {
    const settings = defaultOscSettings();
    const armed = withLevelMidiOn(settings, ["windSpeed", "gateNorth"]);
    assert.equal(armed?.windSpeed.midi, true);
    assert.equal(armed?.gateNorth.midi, false);
    assert.equal(withLevelMidiOn(armed ?? settings, ["windSpeed"]), null);
    assert.ok(MIDI_SYNC_GAP_MS >= 10 && MIDI_SYNC_GAP_MS <= 50);
  });

  it("reads an older shared On flag as both outputs", () => {
    assert.deepEqual(parseStoredChannel({ enabled: true, port: 9101 }, 9101), {
      osc: true,
      midi: true,
      port: 9101,
    });
    assert.deepEqual(parseStoredChannel({ osc: true, midi: false, port: 9102 }, 9101), {
      osc: true,
      midi: false,
      port: 9102,
    });
  });
});
