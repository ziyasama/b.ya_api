import { createRequire } from "node:module";
import { env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";

const require = createRequire(import.meta.url);

type OscMessage = { address: string; args: Array<{ type: string; value: number }> };

type OscUdpPort = {
  open: () => void;
  close: () => void;
  send: (msg: OscMessage) => void;
  on: (event: string, cb: (error?: Error) => void) => void;
};

export type OscSender = {
  sendFloat: (address: string, value: number) => void;
  close: () => void;
};

export function createOscSender(): OscSender {
  const host = env("OSC_HOST", "127.0.0.1");
  const port = envNumber("OSC_PORT", 57121);
  const dryRun = env("OSC_MIDI_DRY_RUN", "true") !== "false";

  if (dryRun) {
    log.info("osc.dry_run", { host, port });
    return {
      sendFloat: (address, value) => {
        log.info("osc.send", { address, value, dryRun: true });
      },
      close: () => undefined,
    };
  }

  try {
    const osc = require("osc") as {
      UDPPort: new (opts: Record<string, unknown>) => OscUdpPort;
    };
    const udp = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: 0,
      remoteAddress: host,
      remotePort: port,
      metadata: true,
    });
    udp.on("error", (error) => {
      log.warn("osc.error", { error: error?.message ?? "osc error" });
    });
    udp.open();
    log.info("osc.open", { host, port });
    return {
      sendFloat: (address, value) => {
        udp.send({
          address,
          args: [{ type: "f", value }],
        });
      },
      close: () => udp.close(),
    };
  } catch (error) {
    log.warn("osc.unavailable", {
      error: error instanceof Error ? error.message : "osc.js failed to load",
    });
    return {
      sendFloat: (address, value) => {
        log.info("osc.send.fallback_log", { address, value });
      },
      close: () => undefined,
    };
  }
}
