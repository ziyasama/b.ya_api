import type {
  AisSnapshotRaw,
  FetcherResult,
  MetarRaw,
  OpenMeteoRaw,
  SeaLevelRaw,
} from "@/lib/fetchers/types";
import type {
  Provenance,
  SourceStatus,
  SourceStatusEntry,
  VesselRecord,
} from "@/lib/supabase/database.types";
import type { BosphorusState } from "@/lib/standardize/types";
import { normalize } from "@/lib/standardize/ranges";
import { straitCounts } from "@/lib/vessels/inside";

function statusFrom<T>(result: FetcherResult<T>): SourceStatusEntry {
  return {
    health: result.health,
    error: result.ok ? undefined : result.error,
    fetchedAt: result.fetchedAt,
  };
}

function ageSeconds(observedAt: string | null | undefined, now: Date): number | null {
  if (!observedAt) return null;
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((now.getTime() - parsed) / 1000);
}

export function toBosphorusState(input: {
  openMeteo: FetcherResult<OpenMeteoRaw>;
  ais: FetcherResult<AisSnapshotRaw>;
  metar?: FetcherResult<MetarRaw>;
  seaLevel?: FetcherResult<SeaLevelRaw>;
  now?: Date;
}): BosphorusState {
  const now = input.now ?? new Date();
  const weather = input.openMeteo.data;
  const ais = input.ais.data;
  const metar = input.metar?.data ?? null;
  const seaLevel = input.seaLevel?.data ?? null;

  // Measured anemometers beat the forecast grid, which reported roughly half
  // the observed speed at the strait. The model stays as a gap filler.
  const metarUsable = metar?.windSpeed != null;
  const windSpeed = metarUsable ? metar.windSpeed : weather?.windSpeed ?? null;
  const windDirection = metarUsable
    ? metar.windDirection ?? weather?.windDirection ?? null
    : weather?.windDirection ?? null;
  const windSource = windSpeed == null ? null : metarUsable ? "metar" : "model";

  const waveHeight = weather?.waveHeight ?? null;
  const wavePeriod = weather?.wavePeriod ?? null;
  const waveDirection = weather?.waveDirection ?? null;
  const swellHeight = weather?.swellHeight ?? null;
  const seaSurfaceTemp = weather?.seaSurfaceTemp ?? null;

  const seaLevelBlackSea = seaLevel?.blackSea?.anomaly ?? null;
  const seaLevelMarmara = seaLevel?.marmara?.anomaly ?? null;
  const seaLevelHead = seaLevel?.head ?? null;

  const vesselData: VesselRecord[] = (ais?.vessels ?? []).map((v) => ({
    mmsi: v.mmsi,
    lat: v.lat,
    lon: v.lon,
    size: v.size,
    shipName: v.shipName,
    shipType: v.shipType,
    transit: v.transit,
  }));
  const heard = ais?.vesselCount ?? null;
  const inside = straitCounts(vesselData);
  const vesselCount = heard == null ? null : inside.total;
  const northboundCount = heard == null ? null : inside.northbound;
  const southboundCount = heard == null ? null : inside.southbound;

  const provenance: Provenance = {};
  if (windSpeed != null) {
    provenance.wind = metarUsable
      ? {
          source: `metar:${(metar.stations ?? []).join("+") || "unknown"}`,
          kind: "measured",
          observedAt: metar.observedAt,
          ageSeconds: ageSeconds(metar.observedAt, now),
          detail: "airport anemometers 15-25 km from the strait",
        }
      : {
          source: "open-meteo:forecast",
          kind: "modelled",
          observedAt: input.openMeteo.fetchedAt,
          ageSeconds: ageSeconds(input.openMeteo.fetchedAt, now),
          detail: "METAR unavailable; model wind underreads the strait",
        };
  }
  if (waveHeight != null || seaSurfaceTemp != null) {
    provenance.wave = {
      source: "open-meteo:marine",
      kind: "modelled",
      observedAt: input.openMeteo.fetchedAt,
      ageSeconds: ageSeconds(input.openMeteo.fetchedAt, now),
      detail:
        weather?.sampleLat != null
          ? `grid cell ${weather.sampleLat},${weather.sampleLon} at the northern mouth`
          : "open water at the northern mouth",
    };
  }
  if (seaLevelHead != null) {
    provenance.seaLevel = {
      source: `ioc:${seaLevel?.blackSea?.code ?? "?"}-${seaLevel?.marmara?.code ?? "?"}`,
      kind: "measured",
      observedAt: seaLevel?.blackSea?.observedAt ?? null,
      ageSeconds: ageSeconds(seaLevel?.blackSea?.observedAt, now),
      detail: "radar tide gauges, anomalies against each station's own 24 h mean",
    };
  }
  if (heard != null) {
    provenance.vessels = {
      source: "openwaters",
      kind: "measured",
      observedAt: input.ais.fetchedAt,
      ageSeconds: ageSeconds(input.ais.fetchedAt, now),
      detail: "ships whose latest AIS position is inside the strait, between the two mouths",
    };
  }

  const sourceStatus: SourceStatus = {
    openMeteo: statusFrom(input.openMeteo),
    ais: statusFrom(input.ais),
  };
  if (input.metar) sourceStatus.metar = statusFrom(input.metar);
  if (input.seaLevel) sourceStatus.seaLevel = statusFrom(input.seaLevel);

  return {
    createdAt: now.toISOString(),
    windSpeed,
    windDirection,
    windSource,
    waveHeight,
    wavePeriod,
    waveDirection,
    swellHeight,
    seaSurfaceTemp,
    sampleLat: weather?.sampleLat ?? null,
    sampleLon: weather?.sampleLon ?? null,
    seaLevelBlackSea,
    seaLevelMarmara,
    seaLevelHead,
    vesselCount,
    northboundCount,
    southboundCount,
    vesselData,

    currentDirection: null,
    currentU: null,
    currentV: null,
    salinity: null,
    waterDensity: null,

    sourceStatus,
    provenance,
    available: {
      wind: windSpeed != null,
      wave: waveHeight != null,
      seaSurfaceTemp: seaSurfaceTemp != null,
      seaLevel: seaLevelHead != null,
      vessels: heard != null,
    },
    normalized: {
      windSpeed: normalize(windSpeed, "windSpeed"),
      windDirection: normalize(windDirection, "windDirection"),
      waveHeight: normalize(waveHeight, "waveHeight"),
      wavePeriod: normalize(wavePeriod, "wavePeriod"),
      swellHeight: normalize(swellHeight, "swellHeight"),
      seaSurfaceTemp: normalize(seaSurfaceTemp, "seaSurfaceTemp"),
      seaLevelHead: normalize(seaLevelHead, "seaLevelHead"),
      vesselCount: normalize(vesselCount, "vesselCount"),
      northboundCount: normalize(northboundCount, "northboundCount"),
      southboundCount: normalize(southboundCount, "southboundCount"),

      currentDirection: 0,
      currentSpeed: 0,
      currentU: 0,
      currentV: 0,
      salinity: 0,
      waterDensity: 0,
    },
  };
}
