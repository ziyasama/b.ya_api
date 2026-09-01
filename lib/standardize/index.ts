import type { FetcherResult, OpenMeteoRaw, AisSnapshotRaw, CmemsRaw } from "@/lib/fetchers/types";
import type { SourceStatusEntry, VesselRecord } from "@/lib/supabase/database.types";
import type { BosphorusState } from "@/lib/standardize/types";
import {
  currentDirectionDeg,
  currentSpeedMs,
  normalize,
} from "@/lib/standardize/ranges";

function statusFrom<T>(result: FetcherResult<T>): SourceStatusEntry {
  return {
    health: result.health,
    error: result.ok ? undefined : result.error,
    fetchedAt: result.fetchedAt,
  };
}

export function toBosphorusState(input: {
  openMeteo: FetcherResult<OpenMeteoRaw>;
  ais: FetcherResult<AisSnapshotRaw>;
  cmems: FetcherResult<CmemsRaw>;
  now?: Date;
}): BosphorusState {
  const weather = input.openMeteo.data;
  const ais = input.ais.data;
  const cmems = input.cmems.data;

  const seaSurfaceTemp = weather?.seaSurfaceTemp ?? cmems?.seaSurfaceTemp ?? null;
  const currentU = cmems?.currentU ?? null;
  const currentV = cmems?.currentV ?? null;
  const currentDirection = currentDirectionDeg(currentU, currentV);
  const speed = currentSpeedMs(currentU, currentV);

  const vesselData: VesselRecord[] = (ais?.vessels ?? []).map((v) => ({
    mmsi: v.mmsi,
    lat: v.lat,
    lon: v.lon,
    size: v.size,
    shipName: v.shipName,
    shipType: v.shipType,
  }));

  const windSpeed = weather?.windSpeed ?? null;
  const waveHeight = weather?.waveHeight ?? null;
  const salinity = cmems?.salinity ?? null;
  const waterDensity = cmems?.waterDensity ?? null;
  const vesselCount = ais?.vesselCount ?? null;

  return {
    createdAt: (input.now ?? new Date()).toISOString(),
    windSpeed,
    waveHeight,
    seaSurfaceTemp,
    currentDirection,
    currentU,
    currentV,
    salinity,
    waterDensity,
    vesselCount,
    vesselData,
    sourceStatus: {
      openMeteo: statusFrom(input.openMeteo),
      ais: statusFrom(input.ais),
      cmems: statusFrom(input.cmems),
    },
    normalized: {
      windSpeed: normalize(windSpeed, "windSpeed"),
      waveHeight: normalize(waveHeight, "waveHeight"),
      seaSurfaceTemp: normalize(seaSurfaceTemp, "seaSurfaceTemp"),
      currentDirection: normalize(currentDirection, "currentDirection"),
      currentSpeed: normalize(speed, "currentSpeed"),
      currentU: normalize(currentU, "currentU"),
      currentV: normalize(currentV, "currentV"),
      salinity: normalize(salinity, "salinity"),
      waterDensity: normalize(waterDensity, "waterDensity"),
      vesselCount: normalize(vesselCount, "vesselCount"),
    },
  };
}
