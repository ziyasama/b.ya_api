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
    latitude?: number;
    longitude?: number;
    ShipName?: string;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: Record<string, unknown>;
    ShipStaticData?: {
      Type?: number;
      Dimension?: {
        A?: number;
        B?: number;
      };
    };
  };
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

/**
 * Persistent AISStream.io WebSocket. Call startAisStream() once from the worker.
 * getAisSnapshot() never throws; it returns last-known-good on failure.
 */
export class AisStreamFetcher {
  private socket: WebSocket | null = null;
  private vessels = new Map<string, AisVesselRaw>();
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;
  private lastError: string | null = null;

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  snapshot(): FetcherResult<AisSnapshotRaw> {
    const data = snapshotFromMap(this.vessels);
    if (this.socket?.readyState === WebSocket.OPEN) {
      remember(STORE_KEY, data);
      return {
        ok: true,
        health: "ok",
        data,
        fetchedAt: new Date().toISOString(),
      };
    }

    const last = recall<AisSnapshotRaw>(STORE_KEY) ?? data;
    const error = this.lastError ?? "AIS WebSocket not connected";
    if (last.vesselCount > 0 || last.vessels.length > 0) {
      return {
        ok: false,
        health: "fallback",
        data: last,
        fetchedAt: new Date().toISOString(),
        error,
      };
    }
    return {
      ok: false,
      health: "unavailable",
      data: last.vesselCount === 0 ? last : null,
      fetchedAt: new Date().toISOString(),
      error,
    };
  }

  private connect(): void {
    const apiKey = env("AISSTREAM_API_KEY");
    if (!apiKey) {
      this.lastError = "AISSTREAM_API_KEY is not set";
      log.warn("ais.missing_api_key");
      return;
    }

    const url = env("AISSTREAM_WS_URL", "wss://stream.aisstream.io/v0/stream");
    log.info("ais.connecting", { url });

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.on("open", () => {
        this.reconnectAttempt = 0;
        this.lastError = null;
        const subscription = {
          APIKey: apiKey,
          BoundingBoxes: [
            [
              [BOSPHORUS.latMin(), BOSPHORUS.lonMin()],
              [BOSPHORUS.latMax(), BOSPHORUS.lonMax()],
            ],
          ],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        };
        socket.send(JSON.stringify(subscription));
        log.info("ais.subscribed");
      });

      socket.on("message", (raw) => {
        try {
          this.handleMessage(JSON.parse(raw.toString()) as AisStreamMessage);
        } catch (error) {
          log.debug("ais.message.parse_failed", {
            error: error instanceof Error ? error.message : "parse error",
          });
        }
      });

      socket.on("close", () => {
        this.lastError = "AIS WebSocket closed";
        log.warn("ais.closed");
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
    const mmsi = message.MetaData?.MMSI != null ? String(message.MetaData.MMSI) : null;
    if (!mmsi) return;

    const existing = this.vessels.get(mmsi);
    const lat = message.MetaData?.latitude ?? existing?.lat;
    const lon = message.MetaData?.longitude ?? existing?.lon;
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
      shipName: message.MetaData?.ShipName?.trim() || existing?.shipName || null,
      shipType: staticData?.Type ?? existing?.shipType ?? null,
      lastSeen: message.MetaData?.time_utc ?? new Date().toISOString(),
    };
    this.vessels.set(mmsi, vessel);
    remember(STORE_KEY, snapshotFromMap(this.vessels));
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    const attempt = this.reconnectAttempt;
    this.reconnectAttempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 8));
    log.info("ais.reconnect_scheduled", { delayMs: delay, attempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

export function aisSnapshotMs(): number {
  return envNumber("AIS_SNAPSHOT_MS", 30_000);
}
