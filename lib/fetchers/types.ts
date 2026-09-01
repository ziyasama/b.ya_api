export type FetcherHealth = "ok" | "fallback" | "unavailable";

export type FetcherResult<T> =
  | { ok: true; health: "ok"; data: T; fetchedAt: string }
  | {
      ok: false;
      health: "fallback" | "unavailable";
      data: T | null;
      fetchedAt: string;
      error: string;
    };

export type OpenMeteoRaw = {
  windSpeed: number | null;
  windDirection: number | null;
  waveHeight: number | null;
  seaSurfaceTemp: number | null;
};

export type AisVesselRaw = {
  mmsi: string;
  lat: number;
  lon: number;
  size: number | null;
  shipName: string | null;
  shipType: number | null;
  lastSeen: string;
};

export type AisSnapshotRaw = {
  vesselCount: number;
  vessels: AisVesselRaw[];
};

export type CmemsRaw = {
  currentU: number | null;
  currentV: number | null;
  salinity: number | null;
  waterDensity: number | null;
  seaSurfaceTemp: number | null;
};
