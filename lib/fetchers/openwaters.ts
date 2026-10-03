import WebSocket from "ws";
import { BOSPHORUS, env, envNumber, vesselCountWindowMs } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { AisSnapshotRaw, AisVesselRaw, FetcherResult } from "@/lib/fetchers/types";
import { detectCrossings, MAX_GAP_MS, transitDirection } from "@/lib/vessels/events";
import type { GateCrossing } from "@/lib/vessels/events";
import { inStrait } from "@/lib/vessels/inside";

const STORE_KEY = "ais";

const POSITION_TYPES = new Set([
  "PositionReport",
  "StandardClassBPositionReport",
  "ExtendedClassBPositionReport",
  "LongRangeAisBroadcastMessage",
]);

const STATIC_TYPES = new Set(["ShipStaticData", "StaticDataReport"]);

const NON_VESSEL_KINDS = new Set(["aton", "base", "station", "sar"]);

export type VesselUpdate = {
  mmsi: string;
  lat: number;
  lon: number;
  lastSeen: string;
  shipName: string | null;
  shipType: number | null;
  size: number | null;
  sog: number | null;
};

type Dimension = { A?: number; B?: number };

type OpenWatersFeature = {
  id?: number | string;
  geometry?: { coordinates?: number[] };
  properties?: {
    mmsi?: number | string;
    name?: string;
    length?: number;
    type?: number;
    seen?: string;
    kind?: string;
    sog?: number;
  };
};

type OpenWatersFrame = {
  type?: string;
  error?: string;
  mmsi?: number | string;
  msg_type?: string;
  lat?: number;
  lon?: number;
  time?: string;
  sog?: number;
  message?: {
    Name?: string;
    Type?: number;
    Sog?: number;
    Dimension?: Dimension;
    ReportA?: { Name?: string };
    ReportB?: { ShipType?: number; Dimension?: Dimension };
  };
};

function staleMs(): number {
  return vesselCountWindowMs();
}

function silenceMs(): number {
  return envNumber("AIS_SILENCE_MS", 180_000);
}

function pollMs(): number {
  return envNumber("AIS_POLL_MS", 60_000);
}

export function approachBox(): {
  latMin: number;
  lonMin: number;
  latMax: number;
  lonMax: number;
} {
  return {
    latMin: BOSPHORUS.approachLatMin(),
    lonMin: BOSPHORUS.approachLonMin(),
    latMax: BOSPHORUS.approachLatMax(),
    lonMax: BOSPHORUS.approachLonMax(),
  };
}

/**
 * Under this speed a ship is maneuvering. The strait limit is 10 knots, so a
 * couple of knots is a berth, not a transit.
 */
export const BERTH_SOG_KN = 3;

/**
 * How long that slow in-strait fix may stand in. Open Waters drops a vessel
 * last reported under way after 30 minutes, and a ship alongside often never
 * sends "moored" on this feed. 48 hours covers a Bosphorus cruise call after
 * the last underway report.
 */
export const BERTH_WINDOW_MS = 48 * 60 * 60 * 1000;

function snapshotUrl(): string {
  const base = env("AIS_SNAPSHOT_URL", "https://ais.openwaters.io/v1/vessels");
  const box = approachBox();
  const url = new URL(base);
  url.searchParams.set("bbox", `${box.latMin},${box.lonMin},${box.latMax},${box.lonMax}`);
  const hours = BERTH_WINDOW_MS / 3_600_000;
  url.searchParams.set("max_age_moving", `${hours}h`);
  return url.toString();
}

function streamUrl(): string {
  return env("AIS_WS_URL", "wss://ais.openwaters.io/v1/stream");
}

function snapshotFromMap(vessels: Map<string, AisVesselRaw>): AisSnapshotRaw {
  const now = Date.now();
  const live: AisVesselRaw[] = [];
  for (const vessel of vessels.values()) {
    if (vesselStillCurrent(vessel, now)) live.push(vessel);
  }
  return { vesselCount: live.length, vessels: live };
}

function cleanName(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function lengthOf(dimension: Dimension | undefined): number | null {
  if (dimension?.A == null || dimension.B == null) return null;
  const length = dimension.A + dimension.B;
  return length > 0 ? length : null;
}

function validPosition(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function readSog(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A fix from the last 4 hours always counts. Past that, only a ship still
 * inside the strait and last heard between 1 and 3 knots: fast enough that
 * Open Waters treats it as "under way" and hides it after 30 minutes, slow
 * enough that it has not left the berth. A stopped ship (under 1 knot) stays
 * on the 4-hour rule.
 */
export function vesselStillCurrent(
  vessel: { lat: number; lon: number; lastSeen: string; sog?: number | null },
  now = Date.now(),
): boolean {
  const age = now - Date.parse(vessel.lastSeen);
  if (!Number.isFinite(age) || age < 0) return false;
  if (age <= staleMs()) return true;
  if (age > BERTH_WINDOW_MS) return false;
  const sog = vessel.sog;
  if (sog == null || sog < 1 || sog >= BERTH_SOG_KN) return false;
  return inStrait(vessel.lat, vessel.lon);
}

/**
 * A connected feed that delivers no ships is how the strait was published as
 * empty for three weeks. Only a recent ingest with a non-zero roster is "ok".
 */
export function classifyVesselFeed(input: {
  vesselCount: number;
  ingestAgeMs: number | null;
  silenceMs: number;
}): "ok" | "late" | "empty" | "waiting" {
  if (input.ingestAgeMs == null) return "waiting";
  if (input.vesselCount > 0 && input.ingestAgeMs <= input.silenceMs) return "ok";
  if (input.vesselCount > 0) return "late";
  if (input.ingestAgeMs <= input.silenceMs) return "empty";
  return "waiting";
}

export function updateFromFeature(feature: OpenWatersFeature, now = Date.now()): VesselUpdate | null {
  const kind = feature.properties?.kind;
  if (kind && NON_VESSEL_KINDS.has(kind)) return null;
  const mmsiRaw = feature.properties?.mmsi ?? feature.id;
  const mmsi = mmsiRaw != null ? String(mmsiRaw) : null;
  const coords = feature.geometry?.coordinates;
  const lon = coords?.[0];
  const lat = coords?.[1];
  const lastSeen = feature.properties?.seen;
  if (!mmsi || lat == null || lon == null || !lastSeen) return null;
  if (!validPosition(lat, lon)) return null;
  const parsed = Date.parse(lastSeen);
  if (!Number.isFinite(parsed)) return null;
  const sog = readSog(feature.properties?.sog);
  const seen = new Date(parsed).toISOString();
  if (!vesselStillCurrent({ lat, lon, lastSeen: seen, sog }, now)) return null;
  const length = feature.properties?.length;
  return {
    mmsi,
    lat,
    lon,
    lastSeen: seen,
    shipName: cleanName(feature.properties?.name),
    shipType: feature.properties?.type ?? null,
    size: length != null && length > 0 ? length : null,
    sog,
  };
}

export function updateFromEvent(frame: OpenWatersFrame, now = Date.now()): VesselUpdate | null {
  if (frame.type !== "event") return null;
  const msgType = frame.msg_type ?? "";
  if (!POSITION_TYPES.has(msgType) && !STATIC_TYPES.has(msgType)) return null;
  const mmsi = frame.mmsi != null ? String(frame.mmsi) : null;
  const lat = frame.lat;
  const lon = frame.lon;
  const lastSeen = frame.time;
  if (!mmsi || lat == null || lon == null || !lastSeen) return null;
  if (!validPosition(lat, lon)) return null;
  const message = frame.message;
  const parsed = Date.parse(lastSeen);
  const seen = Number.isFinite(parsed) ? new Date(parsed).toISOString() : lastSeen;
  const sog = readSog(frame.sog ?? message?.Sog);
  if (!vesselStillCurrent({ lat, lon, lastSeen: seen, sog }, now)) return null;
  return {
    mmsi,
    lat,
    lon,
    lastSeen: seen,
    shipName: cleanName(message?.Name ?? message?.ReportA?.Name),
    shipType: message?.Type ?? message?.ReportB?.ShipType ?? null,
    size: lengthOf(message?.Dimension ?? message?.ReportB?.Dimension),
    sog,
  };
}

/**
 * Keep the newer fix. A gap longer than the crossing window still moves the
 * ship, but it is not a transit: the vessel may have left and come back.
 */
export function mergeVessel(
  existing: AisVesselRaw | undefined,
  update: VesselUpdate,
): { vessel: AisVesselRaw; track: boolean } {
  const updateMs = Date.parse(update.lastSeen);
  const existingMs = existing ? Date.parse(existing.lastSeen) : NaN;
  const newer = !existing || (Number.isFinite(updateMs) && !(updateMs < existingMs));

  if (!newer && existing) {
    return {
      track: false,
      vessel: {
        ...existing,
        shipName: existing.shipName || update.shipName,
        shipType: existing.shipType ?? update.shipType,
        size: existing.size ?? update.size,
        sog: existing.sog ?? update.sog,
      },
    };
  }

  const gapOk =
    !!existing &&
    Number.isFinite(updateMs) &&
    Number.isFinite(existingMs) &&
    updateMs - existingMs <= MAX_GAP_MS;
  const moved = gapOk && (existing.lat !== update.lat || existing.lon !== update.lon);
  let transit = existing?.transit ?? null;
  if (moved && existing) {
    const nextDir = transitDirection(existing, update);
    if (nextDir) transit = nextDir;
  }

  return {
    track: moved,
    vessel: {
      mmsi: update.mmsi,
      lat: update.lat,
      lon: update.lon,
      size: update.size ?? existing?.size ?? null,
      shipName: update.shipName || existing?.shipName || null,
      shipType: update.shipType ?? existing?.shipType ?? null,
      lastSeen: update.lastSeen,
      sog: update.sog,
      transit,
    },
  };
}

/** One GeoJSON pull of the approach box. No socket, so scripts can call it. */
export async function fetchVesselSnapshot(
  now = Date.now(),
): Promise<FetcherResult<AisSnapshotRaw>> {
  const fetchedAt = new Date(now).toISOString();
  const url = snapshotUrl();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      return {
        ok: false,
        health: "unavailable",
        data: null,
        fetchedAt,
        error: `AIS snapshot HTTP ${response.status}`,
      };
    }
    const body = (await response.json()) as { features?: OpenWatersFeature[] };
    const vessels: AisVesselRaw[] = [];
    for (const feature of body.features ?? []) {
      const update = updateFromFeature(feature, now);
      if (!update) continue;
      vessels.push({ ...update, transit: null });
    }
    if (vessels.length === 0) {
      return {
        ok: false,
        health: "unavailable",
        data: null,
        fetchedAt,
        error: "AIS region returned no vessels",
      };
    }
    return {
      ok: true,
      health: "ok",
      data: { vesselCount: vessels.length, vessels },
      fetchedAt,
    };
  } catch (error) {
    return {
      ok: false,
      health: "unavailable",
      data: null,
      fetchedAt,
      error: error instanceof Error ? error.message : "AIS snapshot failed",
    };
  }
}

/**
 * Bosphorus vessel roster.
 *
 * AISStream's socket for this region stayed open and delivered nothing after
 * 11 Sep 2026. Open Waters still carries Istanbul through AISHub plus any
 * live receiver, so the roster is filled from their snapshot and kept current
 * on the websocket. A pull that comes back empty is a failed feed.
 */
export class OpenWatersFetcher {
  private socket: WebSocket | null = null;
  private vessels = new Map<string, AisVesselRaw>();
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;
  private pulling = false;
  private lastError: string | null = null;
  private lastIngestAt: number | null = null;
  private pendingEvents: GateCrossing[] = [];
  private frames = 0;

  start(): void {
    this.shouldRun = true;
    void this.pull();
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        void this.pull();
      }, pollMs());
    }
    this.connect();
  }

  hydrate(vessels: AisVesselRaw[]): void {
    for (const vessel of vessels) {
      if (!this.vessels.has(vessel.mmsi)) {
        this.vessels.set(vessel.mmsi, { ...vessel, transit: vessel.transit ?? null });
      }
    }
    if (vessels.length) log.info("ais.hydrated", { count: vessels.length });
  }

  roster(): AisVesselRaw[] {
    this.prune();
    return snapshotFromMap(this.vessels).vessels;
  }

  drainEvents(): GateCrossing[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.closeSocket();
  }

  snapshot(): FetcherResult<AisSnapshotRaw> {
    this.prune();
    const data = snapshotFromMap(this.vessels);
    const age = this.lastIngestAt == null ? null : Date.now() - this.lastIngestAt;
    const kind = classifyVesselFeed({
      vesselCount: data.vesselCount,
      ingestAgeMs: age,
      silenceMs: silenceMs(),
    });
    const fetchedAt = new Date().toISOString();

    if (kind === "ok") {
      remember(STORE_KEY, data);
      return { ok: true, health: "ok", data, fetchedAt };
    }

    if (kind === "late") {
      return {
        ok: false,
        health: "fallback",
        data,
        fetchedAt,
        error: this.lastError ?? "AIS feed late",
      };
    }

    const last = recall<AisSnapshotRaw>(STORE_KEY);
    const error =
      kind === "empty"
        ? "AIS region returned no vessels"
        : (this.lastError ?? "AIS not fetched yet");
    if (last && last.vesselCount > 0) {
      return { ok: false, health: "fallback", data: last, fetchedAt, error };
    }
    return { ok: false, health: "unavailable", data: null, fetchedAt, error };
  }

  private prune(): void {
    const now = Date.now();
    for (const [mmsi, vessel] of this.vessels) {
      if (!vesselStillCurrent(vessel, now)) this.vessels.delete(mmsi);
    }
  }

  private async pull(): Promise<void> {
    if (this.pulling) return;
    this.pulling = true;
    try {
      const result = await fetchVesselSnapshot();
      if (!result.ok || !result.data) {
        this.lastError = result.ok ? "AIS region returned no vessels" : result.error;
        log.warn("ais.pull.failed", { error: this.lastError });
        return;
      }
      for (const vessel of result.data.vessels) this.apply(vessel);
      this.lastError = null;
      log.info("ais.pull.ok", { count: result.data.vesselCount });
    } finally {
      this.pulling = false;
    }
  }

  private apply(update: VesselUpdate): void {
    const existing = this.vessels.get(update.mmsi);
    const { vessel, track } = mergeVessel(existing, update);
    if (track && existing) {
      this.pendingEvents.push(
        ...detectCrossings(
          {
            mmsi: existing.mmsi,
            lat: existing.lat,
            lon: existing.lon,
            lastSeen: existing.lastSeen,
            shipName: vessel.shipName,
          },
          {
            mmsi: vessel.mmsi,
            lat: vessel.lat,
            lon: vessel.lon,
            lastSeen: vessel.lastSeen,
            shipName: vessel.shipName,
          },
        ),
      );
      if (this.pendingEvents.length > 200) {
        this.pendingEvents = this.pendingEvents.slice(-200);
      }
    }
    this.vessels.set(update.mmsi, vessel);
    this.lastIngestAt = Date.now();
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.removeAllListeners();
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  private connect(): void {
    this.closeSocket();
    const url = streamUrl();
    log.info("ais.connecting", { url });
    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.on("open", () => {
        const box = approachBox();
        socket.send(
          JSON.stringify({
            type: "subscribe",
            bbox: [[box.latMin, box.lonMin, box.latMax, box.lonMax]],
            snapshot: true,
          }),
        );
        log.info("ais.subscribe_sent", { bbox: box });
      });

      socket.on("message", (raw) => {
        try {
          const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw.toString();
          this.handleFrame(JSON.parse(text) as OpenWatersFrame);
        } catch (error) {
          log.debug("ais.message.parse_failed", {
            error: error instanceof Error ? error.message : "parse error",
          });
        }
      });

      socket.on("close", (code, reasonBuf) => {
        const reason = reasonBuf?.toString() || "";
        this.lastError = `AIS WebSocket closed (${code}${reason ? `: ${reason}` : ""})`;
        log.warn("ais.closed", { code, reason: reason || undefined });
        this.scheduleReconnect();
      });

      socket.on("error", (error) => {
        this.lastError = error.message || "AIS WebSocket error";
        log.warn("ais.error", { error: this.lastError });
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "AIS connect failed";
      log.warn("ais.connect.failed", { error: this.lastError });
      this.scheduleReconnect();
    }
  }

  private handleFrame(frame: OpenWatersFrame): void {
    if (frame.type === "welcome") {
      this.reconnectAttempt = 0;
      log.info("ais.subscribed", { limits: (frame as { limits?: unknown }).limits ?? null });
      return;
    }
    if (frame.type === "error") {
      this.lastError = frame.error ?? "AIS subscription error";
      log.warn("ais.server_error", { error: this.lastError });
      return;
    }

    const update = updateFromEvent(frame);
    if (!update) return;
    this.frames += 1;
    if (this.frames <= 3 || this.frames % 200 === 0) {
      log.info("ais.frame", { n: this.frames, type: frame.msg_type, vessels: this.vessels.size });
    }
    this.apply(update);
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 8));
    log.info("ais.reconnect_scheduled", { delayMs: delay, attempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export function aisSnapshotMs(): number {
  return envNumber("AIS_SNAPSHOT_MS", 30_000);
}
