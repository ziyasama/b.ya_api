import { BOSPHORUS, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { FetcherResult, OpenMeteoRaw } from "@/lib/fetchers/types";

const STORE_KEY = "open-meteo";

type OpenMeteoCurrentResponse = {
  current?: {
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wave_height?: number;
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
 * Raw Open-Meteo weather + marine current conditions for the Bosphorus point.
 * Never throws.
 */
export async function fetchOpenMeteo(): Promise<FetcherResult<OpenMeteoRaw>> {
  const lat = BOSPHORUS.lat();
  const lon = BOSPHORUS.lon();
  const forecastUrl = env(
    "OPEN_METEO_FORECAST_URL",
    "https://api.open-meteo.com/v1/forecast",
  );
  const marineUrl = env(
    "OPEN_METEO_MARINE_URL",
    "https://marine-api.open-meteo.com/v1/marine",
  );

  const weatherEndpoint = `${forecastUrl}?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
  const marineEndpoint = `${marineUrl}?latitude=${lat}&longitude=${lon}&current=wave_height,sea_surface_temperature`;

  try {
    const [weather, marine] = await Promise.all([
      getJson(weatherEndpoint),
      getJson(marineEndpoint),
    ]);

    const data: OpenMeteoRaw = {
      windSpeed: weather.current?.wind_speed_10m ?? null,
      windDirection: weather.current?.wind_direction_10m ?? null,
      waveHeight: marine.current?.wave_height ?? null,
      seaSurfaceTemp: marine.current?.sea_surface_temperature ?? null,
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
