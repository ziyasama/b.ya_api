import { BOSPHORUS, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type { CmemsRaw, FetcherResult } from "@/lib/fetchers/types";

const STORE_KEY = "cmems";

/**
 * UNESCO EOS-80 sea water density (kg/m3) at atmospheric pressure.
 * Used when CMEMS/EMODnet returns salinity + temperature but not density.
 */
export function waterDensityKgM3(salinity: number, tempC: number): number {
  const t = tempC;
  const s = salinity;
  const smrt = Math.sqrt(Math.max(s, 0));
  const rhoW =
    999.842594 +
    6.793952e-2 * t -
    9.09529e-3 * t ** 2 +
    1.001685e-4 * t ** 3 -
    1.120083e-6 * t ** 4 +
    6.536332e-9 * t ** 5;
  const a =
    8.24493e-1 -
    4.0899e-3 * t +
    7.6438e-5 * t ** 2 -
    8.2467e-7 * t ** 3 +
    5.3875e-9 * t ** 4;
  const b = -5.72466e-3 + 1.0227e-4 * t - 1.6546e-6 * t ** 2;
  const c = 4.8314e-4;
  return rhoW + a * s + b * s * smrt + c * s ** 2;
}

type ErddapGrid = {
  table?: {
    columnNames?: string[];
    rows?: Array<Array<number | string | null>>;
  };
};

function parseErddap(json: ErddapGrid): CmemsRaw {
  const names = json.table?.columnNames ?? [];
  const row = json.table?.rows?.[0] ?? [];
  const read = (candidates: string[]): number | null => {
    const index = names.findIndex((name) =>
      candidates.some((c) => name.toLowerCase() === c.toLowerCase()),
    );
    if (index < 0) return null;
    const value = row[index];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const currentU = read(["uo", "u", "eastward_sea_water_velocity"]);
  const currentV = read(["vo", "v", "northward_sea_water_velocity"]);
  const salinity = read(["so", "salinity", "sea_water_salinity"]);
  const seaSurfaceTemp = read(["thetao", "temperature", "sst", "sea_surface_temperature"]);
  const densityDirect = read(["density", "sea_water_density", "water_density"]);
  const waterDensity =
    densityDirect ??
    (salinity != null && seaSurfaceTemp != null
      ? waterDensityKgM3(salinity, seaSurfaceTemp)
      : null);

  return { currentU, currentV, salinity, waterDensity, seaSurfaceTemp };
}

/**
 * CMEMS / EMODnet currents, salinity, density.
 *
 * Access methods investigated:
 * 1. Copernicus Marine Toolbox (Python CLI) — official, not runnable in this Node worker.
 * 2. Copernicus Marine Identity + signed S3/subset — requires CMEMS_USERNAME/PASSWORD
 *    and product IDs; not a stable JSON API from Node without the toolbox.
 * 3. EMODnet Physics / any ERDDAP JSON tabledap URL via CMEMS_ERDDAP_URL.
 *
 * This fetcher uses (3) when CMEMS_ERDDAP_URL is set. Otherwise it returns a
 * typed unavailable/fallback result and never throws. Do not invent production data.
 */
export async function fetchCmems(): Promise<FetcherResult<CmemsRaw>> {
  const erddapUrl = env("CMEMS_ERDDAP_URL");
  if (!erddapUrl) {
    const last = recall<CmemsRaw>(STORE_KEY);
    const error =
      "CMEMS_ERDDAP_URL is not set. Configure an ERDDAP JSON subset or run the Copernicus Marine Toolbox offline. Dataset placeholder: " +
      env("CMEMS_DATASET_ID", "cmems_mod_med_phy_anfc_4.2km_P1H-m");
    log.warn("cmems.unconfigured", {
      dataset: env("CMEMS_DATASET_ID"),
      hasUsername: Boolean(env("CMEMS_USERNAME")),
    });
    if (last) {
      return {
        ok: false,
        health: "fallback",
        data: last,
        fetchedAt: new Date().toISOString(),
        error,
      };
    }
    return {
      ok: false,
      health: "unavailable",
      data: null,
      fetchedAt: new Date().toISOString(),
      error,
    };
  }

  try {
    const url = erddapUrl
      .replace("{lat}", String(BOSPHORUS.lat()))
      .replace("{lon}", String(BOSPHORUS.lon()));
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CMEMS/ERDDAP HTTP ${response.status}`);
    }
    const json = (await response.json()) as ErddapGrid;
    const data = parseErddap(json);
    remember(STORE_KEY, data);
    return { ok: true, health: "ok", data, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "CMEMS fetch failed";
    log.warn("cmems.fetch.failed", { error: message });
    const last = recall<CmemsRaw>(STORE_KEY);
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

export function cmemsPollMs(): number {
  return envNumber("CMEMS_POLL_MS", 1_800_000);
}
