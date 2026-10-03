import type { Provenance, SourceStatus, VesselRecord } from "@/lib/supabase/database.types";

/**
 * System contract for the dashboard and OSC/MIDI layer.
 *
 * Signals are grouped by how much they can be trusted. Measured values come
 * from instruments (anemometers, tide gauges, AIS transmitters). Modelled
 * values come from forecast grids and are labelled as such, because the strait
 * is narrower than any available model cell.
 */
export type BosphorusNormalized = {
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  wavePeriod: number;
  swellHeight: number;
  seaSurfaceTemp: number;
  seaLevelHead: number;
  vesselCount: number;
  northboundCount: number;
  southboundCount: number;

  // Retired: the CMEMS ocean column was dropped when the signal set was
  // simplified to wind, wave, current, temperature and vessels. Kept so
  // existing rows and the OSC map stay readable, always 0 for new rows.
  currentDirection: number;
  currentSpeed: number;
  currentU: number;
  currentV: number;
  salinity: number;
  waterDensity: number;
};

/** Which signals carry a real value this cycle, so silence never reads as calm. */
export type BosphorusAvailable = {
  wind: boolean;
  wave: boolean;
  seaSurfaceTemp: boolean;
  seaLevel: boolean;
  vessels: boolean;
};

export type BosphorusState = {
  createdAt: string;

  windSpeed: number | null;
  windDirection: number | null;
  /** "metar" when measured, "model" when Open-Meteo stood in. */
  windSource: string | null;

  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  seaSurfaceTemp: number | null;
  /** Grid cell the marine model actually sampled, recorded so displacement is visible. */
  sampleLat: number | null;
  sampleLon: number | null;

  /** Metres relative to each gauge's own rolling mean, so the two are comparable. */
  seaLevelBlackSea: number | null;
  seaLevelMarmara: number | null;
  /** Black Sea minus Marmara, in metres. Drives the strait's surface flow. */
  seaLevelHead: number | null;

  /** Ships whose latest position is inside the strait. */
  vesselCount: number | null;
  northboundCount: number | null;
  southboundCount: number | null;
  vesselData: VesselRecord[];

  currentDirection: number | null;
  currentU: number | null;
  currentV: number | null;
  salinity: number | null;
  waterDensity: number | null;

  sourceStatus: SourceStatus;
  provenance: Provenance;
  available: BosphorusAvailable;
  normalized: BosphorusNormalized;
};
