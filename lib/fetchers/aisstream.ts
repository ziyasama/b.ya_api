import WebSocket from "ws";
import { BOSPHORUS, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { AisSnapshotRaw, AisVesselRaw, FetcherResult } from "@/lib/fetchers/types";

const STORE_KEY = "ais";

type AisStreamMessage = {
  MessageType?: string;
  MetaData?: {
    MMSI?: number | string;
    mmsi?: number | string;
    latitude?: number;
    longitude?: number;
    Latitude?: number;
    Longitude?: number;
    ShipName?: string;
    time_utc?: string;
    timeUtc?: string;
  };
  Message?: {
    Error?: string;
    CompressionEnabled?: boolean;
    PositionReport?: { Latitude?: number; Longitude?: number; UserID?: number };
    StandardClassBPositionReport?: { Latitude?: number; Longitude?: number; UserID?: number };
    ExtendedClassBPositionReport?: { Latitude?: number; Longitude?: number; UserID?: number };
    ShipStaticData?: {
      Type?: number;
      Dimension?: { A?: number; B?: number };
    };
  };
  error?: string;
  errorMessage?: string;
};

function snapshotFromMap(vessels: Map<string, AisVesselRaw>): AisSnapshotRaw {
  const now = Date.now();
  const staleMs = envNumber("AIS_STALE_MS", 900_000);
  const live: AisVesselRaw[] = [];
  for (const vessel of vessels.values()) {
    if (now - Date.parse(vessel.lastSeen) <= staleMs) {
      live.push(vessel);
    }
  }
  return { vesselCount: live.length, vessels: live };
}

function readNumber(...values: Array<number | undefined | null>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * AISStream sends Go's default time format, "2026-09-02 10:18:59.878860182
 * +0000 UTC", which Postgres rejects outright. V8 parses it, so normalise to
 * ISO here rather than letting it reach the roster upsert.
 */
function toIsoTime(raw: string | undefined): string {
  if (raw) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Persistent AISStream.io WebSocket. Call start() once from the worker.
 * snapshot() never throws; it returns last-known-good on failure.
 */
export class AisStreamFetcher {
  private socket: WebSocket | null = null;
  private vessels = new Map<string, AisVesselRaw>();
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;
  private lastError: string | null = null;
  private confirmed = false;
  private confirmedAt = 0;
  private frames = 0;

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  /**
   * Seed the roster from the durable store on boot. Without this the strait
   * reads as empty for the first minutes after every restart.
   */
  hydrate(vessels: AisVesselRaw[]): void {
    for (const vessel of vessels) {
      if (!this.vessels.has(vessel.mmsi)) this.vessels.set(vessel.mmsi, vessel);
    }
    if (vessels.length) log.info("ais.hydrated", { count: vessels.length });
  }

  /** Live vessels, for persisting back to the durable store. */
  roster(): AisVesselRaw[] {
    return snapshotFromMap(this.vessels).vessels;
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
  }

  snapshot(): FetcherResult<AisSnapshotRaw> {
    const data = snapshotFromMap(this.vessels);
    if (this.confirmed && this.socket?.readyState === WebSocket.OPEN) {
      // A confirmed subscription with an empty roster is not an empty strait,
      // it is a feed that has not spoken yet: AISStream pushes only when a
      // vessel transmits, and the roster takes minutes to fill. Report the gap
      // rather than a zero the dashboard would render as "no traffic".
      const warmupMs = envNumber("AIS_WARMUP_MS", 60_000);
      if (data.vesselCount === 0 && Date.now() - this.confirmedAt < warmupMs) {
        return {
          ok: false,
          health: "unavailable",
          data: null,
          fetchedAt: new Date().toISOString(),
          error: "AIS warming up: subscription confirmed, no positions yet",
        };
      }

      remember(STORE_KEY, data);
      return {
        ok: true,
        health: "ok",
        data,
        fetchedAt: new Date().toISOString(),
      };
    }

    const last = recall<AisSnapshotRaw>(STORE_KEY);
    const error = this.lastError ?? "AIS WebSocket not connected";
    if (last && (last.vesselCount > 0 || last.vessels.length > 0)) {
      return {
        ok: false,
        health: "fallback",
        data: last,
        fetchedAt: new Date().toISOString(),
        error,
      };
    }
    // Explicitly null rather than an empty snapshot. Returning
    // { vesselCount: 0 } here would publish a disconnected socket as a count
    // of zero vessels, which is the false-zero this pipeline exists to avoid.
    return {
      ok: false,
      health: "unavailable",
      data: null,
      fetchedAt: new Date().toISOString(),
      error,
    };
  }

  private closeSocket(): void {
    this.confirmed = false;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.removeAllListeners();
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  private connect(): void {
    const apiKey = env("AISSTREAM_API_KEY");
    if (!apiKey || apiKey === "your-aisstream-api-key") {
      this.lastError = "AISSTREAM_API_KEY is not set";
      log.warn("ais.missing_api_key");
      return;
    }

    this.closeSocket();
    const url = env("AISSTREAM_WS_URL", "wss://stream.aisstream.io/v0/stream");
    log.info("ais.connecting", { url });

    try {
      const socket = new WebSocket(url, { perMessageDeflate: true });
      this.socket = socket;

      socket.on("open", () => {
        const strait = [
          [BOSPHORUS.latMin(), BOSPHORUS.lonMin()],
          [BOSPHORUS.latMax(), BOSPHORUS.lonMax()],
        ];
        // Approaches: Sea of Marmara → strait → Black Sea. AISStream is
        // event-driven; a tight box can sit silent for minutes. Same bounds
        // the /map route draws (lib/map/geo.ts) — keep both in sync via env.
        const approaches = [
          [BOSPHORUS.approachLatMin(), BOSPHORUS.approachLonMin()],
          [BOSPHORUS.approachLatMax(), BOSPHORUS.approachLonMax()],
        ];
        const subscription: Record<string, unknown> = {
          APIKey: apiKey,
          BoundingBoxes: [strait, approaches],
        };
        socket.send(JSON.stringify(subscription));
        log.info("ais.subscribe_sent", { boxes: subscription.BoundingBoxes });
      });

      socket.on("message", (raw) => {
        try {
          const text = Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString("utf8")
              : raw.toString();
          this.handleMessage(JSON.parse(text) as AisStreamMessage);
        } catch (error) {
          log.debug("ais.message.parse_failed", {
            error: error instanceof Error ? error.message : "parse error",
          });
        }
      });

      socket.on("close", (code, reasonBuf) => {
        const reason = reasonBuf?.toString() || "";
        this.confirmed = false;
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

  private handleMessage(message: AisStreamMessage): void {
    this.frames += 1;
    if (this.frames <= 12 || this.frames % 100 === 0) {
      log.info("ais.frame", {
        n: this.frames,
        type: message.MessageType ?? "unknown",
        metaKeys: message.MetaData ? Object.keys(message.MetaData) : [],
        vessels: this.vessels.size,
      });
    }

    if (message.MessageType === "SubscriptionConfirmation") {
      this.confirmed = true;
      this.confirmedAt = Date.now();
      this.reconnectAttempt = 0;
      this.lastError = null;
      log.info("ais.subscribed", {
        compression: message.Message?.CompressionEnabled ?? null,
      });
      return;
    }

    const serverError = message.error ?? message.errorMessage ?? message.Message?.Error;
    if (serverError) {
      this.lastError = String(serverError);
      log.warn("ais.server_error", { error: this.lastError, type: message.MessageType });
      return;
    }

    const meta = message.MetaData;
    const report =
      message.Message?.PositionReport ??
      message.Message?.StandardClassBPositionReport ??
      message.Message?.ExtendedClassBPositionReport;

    const mmsiRaw = meta?.MMSI ?? meta?.mmsi ?? report?.UserID;
    const mmsi = mmsiRaw != null ? String(mmsiRaw) : null;
    if (!mmsi) return;

    const existing = this.vessels.get(mmsi);
    const lat = readNumber(meta?.Latitude, meta?.latitude, report?.Latitude, existing?.lat);
    const lon = readNumber(meta?.Longitude, meta?.longitude, report?.Longitude, existing?.lon);
    if (lat == null || lon == null) return;

    const staticData = message.Message?.ShipStaticData;
    const length =
      staticData?.Dimension?.A != null && staticData?.Dimension?.B != null
        ? staticData.Dimension.A + staticData.Dimension.B
        : existing?.size ?? null;

    const vessel: AisVesselRaw = {
      mmsi,
      lat,
      lon,
      size: length,
      shipName: meta?.ShipName?.trim() || existing?.shipName || null,
      shipType: staticData?.Type ?? existing?.shipType ?? null,
      lastSeen: toIsoTime(meta?.time_utc ?? meta?.timeUtc),
    };
    this.vessels.set(mmsi, vessel);
    remember(STORE_KEY, snapshotFromMap(this.vessels));
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
