import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import type { BosphorusState } from "@/lib/standardize/types";

export function stateToRow(
  state: BosphorusState,
): Omit<BosphorusStateRow, "id" | "created_at"> {
  return {
    wind_speed: state.windSpeed,
    wave_height: state.waveHeight,
    sea_surface_temp: state.seaSurfaceTemp,
    current_direction: state.currentDirection,
    current_u: state.currentU,
    current_v: state.currentV,
    salinity: state.salinity,
    water_density: state.waterDensity,
    vessel_count: state.vesselCount,
    vessel_data: state.vesselData,
    source_status: state.sourceStatus,
    normalized: state.normalized,
  };
}

export function rowToState(row: BosphorusStateRow): BosphorusState {
  return {
    createdAt: row.created_at,
    windSpeed: row.wind_speed,
    waveHeight: row.wave_height,
    seaSurfaceTemp: row.sea_surface_temp,
    currentDirection: row.current_direction,
    currentU: row.current_u,
    currentV: row.current_v,
    salinity: row.salinity,
    waterDensity: row.water_density,
    vesselCount: row.vessel_count,
    vesselData: row.vessel_data ?? [],
    sourceStatus: row.source_status,
    normalized: {
      windSpeed: row.normalized?.windSpeed ?? 0,
      waveHeight: row.normalized?.waveHeight ?? 0,
      seaSurfaceTemp: row.normalized?.seaSurfaceTemp ?? 0,
      currentDirection: row.normalized?.currentDirection ?? 0,
      currentSpeed: row.normalized?.currentSpeed ?? 0,
      currentU: row.normalized?.currentU ?? 0,
      currentV: row.normalized?.currentV ?? 0,
      salinity: row.normalized?.salinity ?? 0,
      waterDensity: row.normalized?.waterDensity ?? 0,
      vesselCount: row.normalized?.vesselCount ?? 0,
    },
  };
}
