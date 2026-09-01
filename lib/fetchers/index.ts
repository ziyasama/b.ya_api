export { fetchOpenMeteo, openMeteoPollMs } from "@/lib/fetchers/open-meteo";
export { AisStreamFetcher, aisSnapshotMs } from "@/lib/fetchers/aisstream";
export { fetchCmems, cmemsPollMs, waterDensityKgM3 } from "@/lib/fetchers/cmems";
export type {
  AisSnapshotRaw,
  AisVesselRaw,
  CmemsRaw,
  FetcherResult,
  OpenMeteoRaw,
} from "@/lib/fetchers/types";
