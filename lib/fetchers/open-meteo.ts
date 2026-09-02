import { BOSPHORUS, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { FetcherResult, OpenMeteoRaw } from "@/lib/fetchers/types";

const STORE_KEY = "open-meteo";

type OpenMeteoCurrentResponse = {
  /** The grid cell actually used, which is not necessarily the one requested. */
  latitude?: number;
  longitude?: number;
  current?: {
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wave_height?: number;
    wave_period?: number;
    wave_direction?: number;
    swell_wave_height?: number;
    sea_surface_temperature?: number;
  };
};

async function getJson(url: string): Promise<OpenMeteoCurrentResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }
  return (await response.json()) as OpenMeteoCurrentResponse;
}

/**
 * Modelled wind at the strait plus waves and SST from open water at the
 * northern mouth. The wave model has no cell inside the strait, so requesting
 * one there snaps the sample ~9 km south into the Marmara and returns an
 * inshore near-zero; see BOSPHORUS.waveLat in lib/env.ts. Wind stays as a
 * fallback behind measured METAR. Never throws.
 */
export async function fetchOpenMeteo(): Promise<FetcherResult<OpenMeteoRaw>> {
  const lat = BOSPHORUS.lat();
  const lon = BOSPHORUS.lon();
  const waveLat = BOSPHORUS.waveLat();
  const waveLon = BOSPHORUS.waveLon();
  const forecastUrl = env(
    "OPEN_METEO_FORECAST_URL",
    "https://api.open-meteo.com/v1/forecast",
  );
  const marineUrl = env(
    "OPEN_METEO_MARINE_URL",
    "https://marine-api.open-meteo.com/v1/marine",
  );

  const weatherEndpoint = `${forecastUrl}?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
  const marineEndpoint = `${marineUrl}?latitude=${waveLat}&longitude=${waveLon}&current=wave_height,wave_period,wave_direction,swell_wave_height,sea_surface_temperature`;

  try {
    const [weather, marine] = await Promise.all([
      getJson(weatherEndpoint),
      getJson(marineEndpoint),
    ]);

    const data: OpenMeteoRaw = {
      windSpeed: weather.current?.wind_speed_10m ?? null,
      windDirection: weather.current?.wind_direction_10m ?? null,
      waveHeight: marine.current?.wave_height ?? null,
      wavePeriod: marine.current?.wave_period ?? null,
      waveDirection: marine.current?.wave_direction ?? null,
      swellHeight: marine.current?.swell_wave_height ?? null,
      seaSurfaceTemp: marine.current?.sea_surface_temperature ?? null,
      sampleLat: marine.latitude ?? null,
      sampleLon: marine.longitude ?? null,
    };

    remember(STORE_KEY, data);
    return { ok: true, health: "ok", data, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Open-Meteo fetch failed";
    log.warn("open-meteo.fetch.failed", { error: message });
    const last = recall<OpenMeteoRaw>(STORE_KEY);
    if (last) {
      return {
        ok: false,
        health: "fallback",
        data: last,
        fetchedAt: new Date().toISOString(),
        error: message,
      };
    }
    return {
      ok: false,
      health: "unavailable",
      data: null,
      fetchedAt: new Date().toISOString(),
      error: message,
    };
  }
}

export function openMeteoPollMs(): number {
  return envNumber("OPEN_METEO_POLL_MS", 300_000);
}
