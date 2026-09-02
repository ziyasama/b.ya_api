import type { BosphorusAvailable, BosphorusState } from "@/lib/standardize/types";
import { AVAILABILITY_MAP, SIGNAL_MAP } from "@/lib/osc-midi/mapping";
import { createMidiSender, type MidiSender } from "@/lib/osc-midi/midi";
import { createOscSender, type OscSender } from "@/lib/osc-midi/osc";
import { scaleMidiCc, scaleOsc } from "@/lib/osc-midi/scale";
import { log } from "@/lib/logger";

export type SignalBroadcaster = {
  emit: (state: BosphorusState) => void;
  close: () => void;
};

export function createBroadcaster(): SignalBroadcaster {
  const osc: OscSender = createOscSender();
  const midi: MidiSender = createMidiSender();

  return {
    emit(state: BosphorusState) {
      for (const target of SIGNAL_MAP) {
        const normalized = state.normalized[target.field];
        osc.sendFloat(target.oscAddress, scaleOsc(normalized));
        midi.sendCc(target.midiChannel, target.midiCc, scaleMidiCc(normalized));
      }
      // Sent alongside the values so a patch can mute a voice rather than
      // read a normalized 0 as a genuine calm.
      for (const flag of AVAILABILITY_MAP) {
        const present = state.available[flag.field as keyof BosphorusAvailable];
        osc.sendFloat(flag.oscAddress, present ? 1 : 0);
      }
      log.debug("broadcast.emit", { createdAt: state.createdAt });
    },
    close() {
      osc.close();
      midi.close();
    },
  };
}
