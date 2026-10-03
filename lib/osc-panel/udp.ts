import dgram from "node:dgram";
import { createRequire } from "node:module";
import type { OscOutbound } from "@/lib/osc-panel/catalog";

const require = createRequire(import.meta.url);

type OscLib = {
  writePacket: (
    packet: { address: string; args: Array<{ type: string; value: number }> },
    options: { metadata: boolean },
  ) => ArrayBufferView;
};

const osc = require("osc") as OscLib;

/** Live's OSC socket on this Mac is IPv4. Protokol binds IPv6 only. Send both. */
const TARGETS = [
  { family: "udp4" as const, address: "127.0.0.1" },
  { family: "udp6" as const, address: "::1" },
];

const sockets = new Map<string, dgram.Socket>();

function socketFor(family: "udp4" | "udp6"): dgram.Socket {
  const existing = sockets.get(family);
  if (existing) return existing;
  const socket = dgram.createSocket(family);
  socket.unref();
  socket.on("error", () => {
    sockets.delete(family);
    socket.close();
  });
  sockets.set(family, socket);
  return socket;
}

function sendTo(
  family: "udp4" | "udp6",
  address: string,
  port: number,
  packet: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    socketFor(family).send(packet, port, address, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** One float to 127.0.0.1 and to ::1, on the row's port. */
export async function sendOscFloats(messages: OscOutbound[]): Promise<void> {
  const failures: string[] = [];
  let attempts = 0;

  await Promise.all(
    messages.map(async (message) => {
      const encoded = osc.writePacket(
        {
          address: message.address,
          args: [{ type: "f", value: message.value }],
        },
        { metadata: true },
      );
      const packet = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      await Promise.all(
        TARGETS.map(async (target) => {
          attempts += 1;
          try {
            await sendTo(target.family, target.address, message.port, packet);
          } catch (error) {
            failures.push(error instanceof Error ? error.message : "OSC send failed");
          }
        }),
      );
    }),
  );

  if (attempts > 0 && failures.length === attempts) {
    throw new Error(failures[0] ?? "OSC send failed");
  }
}
