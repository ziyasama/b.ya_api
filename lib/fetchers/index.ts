export { fetchOpenMeteo, openMeteoPollMs } from "@/lib/fetchers/open-meteo";
export { fetchMetar, metarPollMs } from "@/lib/fetchers/metar";
export { fetchSeaLevel, seaLevelPollMs } from "@/lib/fetchers/sea-level";
export { OpenWatersFetcher, aisSnapshotMs, fetchVesselSnapshot } from "@/lib/fetchers/openwaters";
export type {
  AisSnapshotRaw,
  AisVesselRaw,
  FetcherResult,
  MetarRaw,
  OpenMeteoRaw,
  SeaLevelRaw,
  SeaLevelStationRaw,
} from "@/lib/fetchers/types";
