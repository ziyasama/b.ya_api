import { createRequire } from "node:module";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

const require = createRequire(import.meta.url);

export type MidiSender = {
  sendCc: (channel: number, controller: number, value: number) => void;
  close: () => void;
};

type EasyMidiOutput = {
  send: (type: string, msg: { controller: number; value: number; channel: number }) => void;
  close: () => void;
};

export function createMidiSender(): MidiSender {
  const name = env("MIDI_PORT_NAME", "Bosphorus Hub");
  const dryRun = env("OSC_MIDI_DRY_RUN", "true") !== "false";

  if (dryRun) {
    log.info("midi.dry_run", { port: name });
    return {
      sendCc: (channel, controller, value) => {
        log.info("midi.cc", { channel, controller, value, dryRun: true });
      },
      close: () => undefined,
    };
  }

  try {
    const easymidi = require("easymidi") as {
      Output: new (portName: string, virtual?: boolean) => EasyMidiOutput;
    };
    const output = new easymidi.Output(name, true);
    log.info("midi.open", { port: name, virtual: true });
    return {
      sendCc: (channel, controller, value) => {
        output.send("cc", { channel, controller, value });
      },
      close: () => output.close(),
    };
  } catch (error) {
    log.warn("midi.unavailable", {
      error: error instanceof Error ? error.message : "easymidi failed to load",
    });
    return {
      sendCc: (channel, controller, value) => {
        log.info("midi.cc.fallback_log", { channel, controller, value });
      },
      close: () => undefined,
    };
  }
}
