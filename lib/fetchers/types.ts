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
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  seaSurfaceTemp: number | null;
  /** Grid cell the marine API actually used, so a silently displaced sample can never hide again. */
  sampleLat: number | null;
  sampleLon: number | null;
};

/** Measured wind from airport anemometers. */
export type MetarRaw = {
  windSpeed: number | null;
  windDirection: number | null;
  airTemp: number | null;
  /** Stations that contributed to the median, for provenance. */
  stations: string[];
  observedAt: string | null;
};

export type SeaLevelStationRaw = {
  code: string;
  /** Metres above the station's own local datum, which differs per station. */
  level: number | null;
  /** Level minus the station's own rolling mean, which is comparable across stations. */
  anomaly: number | null;
  samples: number;
  observedAt: string | null;
};

export type SeaLevelRaw = {
  blackSea: SeaLevelStationRaw | null;
  marmara: SeaLevelStationRaw | null;
  /** Black Sea anomaly minus Marmara anomaly, in metres. The driver of the strait's surface flow. */
  head: number | null;
};

export type AisVesselRaw = {
  mmsi: string;
  lat: number;
  lon: number;
  size: number | null;
  shipName: string | null;
  shipType: number | null;
  lastSeen: string;
  /**
   * Knots at that fix. Missing on older rows. A slow in-strait fix is kept
   * past the usual window; see vesselStillCurrent.
   */
  sog?: number | null;
  /** Sign of latitude change vs the previous fix. Null until the vessel has moved. */
  transit: "northbound" | "southbound" | null;
};

export type AisSnapshotRaw = {
  vesselCount: number;
  vessels: AisVesselRaw[];
};

