import type { SourceStatus, VesselRecord } from "@/lib/supabase/database.types";

/**
 * System contract for the dashboard and OSC/MIDI layer.
 * Freeze this interface at the Step 4 checkpoint.
 */
export type BosphorusNormalized = {
  windSpeed: number;
  waveHeight: number;
  seaSurfaceTemp: number;
  currentDirection: number;
  currentSpeed: number;
  currentU: number;
  currentV: number;
  salinity: number;
  waterDensity: number;
  vesselCount: number;
};

export type BosphorusState = {
  createdAt: string;
  windSpeed: number | null;
  waveHeight: number | null;
  seaSurfaceTemp: number | null;
  currentDirection: number | null;
  currentU: number | null;
  currentV: number | null;
  salinity: number | null;
  waterDensity: number | null;
  vesselCount: number | null;
  vesselData: VesselRecord[];
  sourceStatus: SourceStatus;
  normalized: BosphorusNormalized;
};
