import { METAR_STATIONS, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { FetcherResult, MetarRaw } from "@/lib/fetchers/types";

const STORE_KEY = "metar";
const KNOTS_TO_MS = 0.514444;

type MetarReport = {
  icaoId?: string;
  obsTime?: number;
  wdir?: number | string | null;
  wspd?: number | null;
  temp?: number | null;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Directions are circular, so an arithmetic mean of 350 and 10 gives 180.
 * Average the unit vectors instead.
 */
function circularMeanDeg(degrees: number[]): number | null {
  if (!degrees.length) return null;
  let x = 0;
  let y = 0;
  for (const deg of degrees) {
    const rad = (deg * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Measured wind from Istanbul airport anemometers via the Aviation Weather
 * Center. Free, keyless. Takes the median across reporting stations so one
 * quiet station cannot swing the value. Never throws.
 */
export async function fetchMetar(): Promise<FetcherResult<MetarRaw>> {
  const stations = METAR_STATIONS();
  const base = env("METAR_URL", "https://aviationweather.gov/api/data/metar");
  const maxAgeMs = envNumber("METAR_MAX_AGE_MS", 5_400_000);
  const url = `${base}?ids=${stations.join(",")}&format=json`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "bosphorus-data-hub" },
    });
    if (!response.ok) throw new Error(`METAR HTTP ${response.status}`);

    const reports = (await response.json()) as MetarReport[];
    if (!Array.isArray(reports) || reports.length === 0) {
      throw new Error("METAR returned no reports");
    }

    const now = Date.now();
    const speeds: number[] = [];
    const directions: number[] = [];
    const temps: number[] = [];
    const contributing: string[] = [];
    let newestObs = 0;

    for (const report of reports) {
      // obsTime is unix seconds. A stale observation is worse than none,
      // because it would be published as if it were current.
      const obsMs = typeof report.obsTime === "number" ? report.obsTime * 1000 : 0;
      if (!obsMs || now - obsMs > maxAgeMs) continue;

      if (typeof report.wspd === "number" && Number.isFinite(report.wspd)) {
        speeds.push(report.wspd * KNOTS_TO_MS);
        contributing.push(report.icaoId ?? "unknown");
        newestObs = Math.max(newestObs, obsMs);
      }
      // wdir is "VRB" when variable, which carries no usable direction.
      if (typeof report.wdir === "number" && Number.isFinite(report.wdir)) {
        directions.push(report.wdir);
      }
      if (typeof report.temp === "number" && Number.isFinite(report.temp)) {
        temps.push(report.temp);
      }
    }

    if (!speeds.length) throw new Error("METAR reports were all stale or missing wind");

    const data: MetarRaw = {
      windSpeed: median(speeds),
      windDirection: circularMeanDeg(directions),
      airTemp: median(temps),
      stations: contributing,
      observedAt: newestObs ? new Date(newestObs).toISOString() : null,
    };

    remember(STORE_KEY, data);
    return { ok: true, health: "ok", data, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "METAR fetch failed";
    log.warn("metar.fetch.failed", { error: message });
    const last = recall<MetarRaw>(STORE_KEY);
    return {
      ok: false,
      health: last ? "fallback" : "unavailable",
      data: last,
      fetchedAt: new Date().toISOString(),
      error: message,
    };
  }
}

export function metarPollMs(): number {
  return envNumber("METAR_POLL_MS", 600_000);
}
