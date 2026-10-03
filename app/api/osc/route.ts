import {
  isOscAddress,
  isOscPort,
  OSC_CHANNELS,
  type OscOutbound,
} from "@/lib/osc-panel/catalog";
import { sendOscFloats } from "@/lib/osc-panel/udp";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Forwards floats chosen by the open dashboard to 127.0.0.1 and ::1.
 * The host is fixed here; the body cannot name another machine.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseMessages(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.messages.length === 0) {
    return Response.json({ ok: true, sent: 0 });
  }

  try {
    await sendOscFloats(parsed.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OSC send failed";
    log.warn("osc.panel.send_failed", { error: message });
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ ok: true, sent: parsed.messages.length });
}

function parseMessages(
  body: unknown,
): { ok: true; messages: OscOutbound[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !("messages" in body)) {
    return { ok: false, error: "expected messages" };
  }
  const messages = (body as { messages: unknown }).messages;
  if (!Array.isArray(messages)) return { ok: false, error: "expected messages" };
  if (messages.length > OSC_CHANNELS.length) {
    return { ok: false, error: "too many messages" };
  }

  const parsed: OscOutbound[] = [];
  for (const item of messages) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "invalid message" };
    }
    const { address, port, value } = item as Record<string, unknown>;
    if (typeof address !== "string" || !isOscAddress(address)) {
      return { ok: false, error: "unknown address" };
    }
    if (!isOscPort(port)) return { ok: false, error: "port out of range" };
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: "value must be a finite number" };
    }
    parsed.push({ address, port, value });
  }
  return { ok: true, messages: parsed };
}
