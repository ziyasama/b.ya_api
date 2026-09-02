import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import type { BosphorusState } from "@/lib/standardize/types";

export function stateToRow(
  state: BosphorusState,
): Omit<BosphorusStateRow, "id" | "created_at"> {
  return {
    wind_speed: state.windSpeed,
    wind_direction: state.windDirection,
    wind_source: state.windSource,
    wave_height: state.waveHeight,
    wave_period: state.wavePeriod,
    wave_direction: state.waveDirection,
    swell_height: state.swellHeight,
    sea_surface_temp: state.seaSurfaceTemp,
    sample_lat: state.sampleLat,
    sample_lon: state.sampleLon,
    sea_level_black_sea: state.seaLevelBlackSea,
    sea_level_marmara: state.seaLevelMarmara,
    sea_level_head: state.seaLevelHead,
    vessel_count: state.vesselCount,
    vessel_data: state.vesselData,
    source_status: state.sourceStatus,
    provenance: state.provenance,
    available: state.available,
    normalized: state.normalized,

    current_direction: state.currentDirection,
    current_u: state.currentU,
    current_v: state.currentV,
    salinity: state.salinity,
    water_density: state.waterDensity,
  };
}

export function rowToState(row: BosphorusStateRow): BosphorusState {
  const available = row.available ?? {};
  return {
    createdAt: row.created_at,
    windSpeed: row.wind_speed,
    windDirection: row.wind_direction ?? null,
    windSource: row.wind_source ?? null,
    waveHeight: row.wave_height,
    wavePeriod: row.wave_period ?? null,
    waveDirection: row.wave_direction ?? null,
    swellHeight: row.swell_height ?? null,
    seaSurfaceTemp: row.sea_surface_temp,
    sampleLat: row.sample_lat ?? null,
    sampleLon: row.sample_lon ?? null,
    seaLevelBlackSea: row.sea_level_black_sea ?? null,
    seaLevelMarmara: row.sea_level_marmara ?? null,
    seaLevelHead: row.sea_level_head ?? null,
    vesselCount: row.vessel_count,
    northboundCount:
      row.vessel_count == null
        ? null
        : (row.vessel_data ?? []).filter((v) => v.transit === "northbound").length,
    southboundCount:
      row.vessel_count == null
        ? null
        : (row.vessel_data ?? []).filter((v) => v.transit === "southbound").length,
    vesselData: row.vessel_data ?? [],

    currentDirection: row.current_direction,
    currentU: row.current_u,
    currentV: row.current_v,
    salinity: row.salinity,
    waterDensity: row.water_density,

    sourceStatus: row.source_status,
    provenance: row.provenance ?? {},
    // Rows written before the availability flags existed fall back to
    // "a value is present", which is the same judgement the UI made then.
    available: {
      wind: available.wind ?? row.wind_speed != null,
      wave: available.wave ?? row.wave_height != null,
      seaSurfaceTemp: available.seaSurfaceTemp ?? row.sea_surface_temp != null,
      seaLevel: available.seaLevel ?? row.sea_level_head != null,
      vessels: available.vessels ?? row.vessel_count != null,
    },
    normalized: {
      windSpeed: row.normalized?.windSpeed ?? 0,
      windDirection: row.normalized?.windDirection ?? 0,
      waveHeight: row.normalized?.waveHeight ?? 0,
      wavePeriod: row.normalized?.wavePeriod ?? 0,
      swellHeight: row.normalized?.swellHeight ?? 0,
      seaSurfaceTemp: row.normalized?.seaSurfaceTemp ?? 0,
      seaLevelHead: row.normalized?.seaLevelHead ?? 0,
      vesselCount: row.normalized?.vesselCount ?? 0,
      northboundCount: row.normalized?.northboundCount ?? 0,
      southboundCount: row.normalized?.southboundCount ?? 0,

      currentDirection: row.normalized?.currentDirection ?? 0,
      currentSpeed: row.normalized?.currentSpeed ?? 0,
      currentU: row.normalized?.currentU ?? 0,
      currentV: row.normalized?.currentV ?? 0,
      salinity: row.normalized?.salinity ?? 0,
      waterDensity: row.normalized?.waterDensity ?? 0,
    },
  };
}
