import { SEA_LEVEL, env, envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { recall, remember } from "@/lib/fetchers/last-known";
import type {
  FetcherResult,
  SeaLevelRaw,
  SeaLevelStationRaw,
} from "@/lib/fetchers/types";

const STORE_KEY = "sea-level";

type IocSample = {
  slevel?: number;
  stime?: string;
  sensor?: string;
};

/**
 * Each gauge sits on its own local datum, so raw levels from two stations
 * cannot be subtracted. We hold each station's own rolling mean as a datum and
 * compare anomalies instead. The mean window is long (24 h by default) but the
 * per-poll window is short, because the gauges sample every ~6 seconds and a
 * full day is roughly 14,000 rows.
 */
type Baseline = { mean: number; computedAt: number };
const baselines = new Map<string, Baseline>();

function iocUrl(code: string, periodDays: number): string {
  const base = env(
    "SEA_LEVEL_URL",
    "https://www.ioc-sealevelmonitoring.org/service.php",
  );
  return `${base}?query=data&code=${encodeURIComponent(code)}&period=${periodDays}&format=json`;
}

async function getSamples(code: string, periodDays: number): Promise<IocSample[]> {
  const response = await fetch(iocUrl(code, periodDays), { cache: "no-store" });
  if (!response.ok) throw new Error(`IOC HTTP ${response.status} for ${code}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) throw new Error(`IOC returned no series for ${code}`);
  return (body as IocSample[]).filter(
    (s) => typeof s.slevel === "number" && Number.isFinite(s.slevel),
  );
}

async function baselineFor(code: string): Promise<number | null> {
  const ttlMs = envNumber("SEA_LEVEL_BASELINE_TTL_MS", 21_600_000);
  const cached = baselines.get(code);
  if (cached && Date.now() - cached.computedAt < ttlMs) return cached.mean;

  const samples = await getSamples(code, SEA_LEVEL.baselineHours() / 24);
  if (!samples.length) return cached?.mean ?? null;

  const mean =
    samples.reduce((sum, s) => sum + (s.slevel as number), 0) / samples.length;
  baselines.set(code, { mean, computedAt: Date.now() });
  log.info("sea-level.baseline", { code, mean: Number(mean.toFixed(4)), samples: samples.length });
  return mean;
}

async function readStation(code: string): Promise<SeaLevelStationRaw> {
  const windowDays = envNumber("SEA_LEVEL_WINDOW_DAYS", 0.01);
  const [samples, mean] = await Promise.all([
    getSamples(code, windowDays),
    baselineFor(code),
  ]);

  if (!samples.length) throw new Error(`IOC station ${code} has no recent data`);

  const latest = samples[samples.length - 1];
  const level = latest.slevel as number;
  return {
    code,
    level,
    anomaly: mean == null ? null : level - mean,
    samples: samples.length,
    observedAt: latest.stime ? `${latest.stime.replace(" ", "T")}Z` : null,
  };
}

/** Tries the primary gauge, then the backup, so one dead station is not silence. */
async function readWithBackup(
  primary: string,
  backup: string,
): Promise<SeaLevelStationRaw> {
  try {
    return await readStation(primary);
  } catch (error) {
    log.warn("sea-level.primary_failed", {
      code: primary,
      error: error instanceof Error ? error.message : "unknown",
    });
    return await readStation(backup);
  }
}

/**
 * Measured sea level from IOC tide gauges either side of the strait, plus the
 * Black Sea minus Marmara head. Free, keyless. Never throws.
 */
export async function fetchSeaLevel(): Promise<FetcherResult<SeaLevelRaw>> {
  try {
    const [blackSea, marmara] = await Promise.all([
      readWithBackup(SEA_LEVEL.blackSea(), SEA_LEVEL.blackSeaBackup()),
      readWithBackup(SEA_LEVEL.marmara(), SEA_LEVEL.marmaraBackup()),
    ]);

    const head =
      blackSea.anomaly != null && marmara.anomaly != null
        ? blackSea.anomaly - marmara.anomaly
        : null;

    const data: SeaLevelRaw = { blackSea, marmara, head };
    remember(STORE_KEY, data);
    return { ok: true, health: "ok", data, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sea level fetch failed";
    log.warn("sea-level.fetch.failed", { error: message });
    const last = recall<SeaLevelRaw>(STORE_KEY);
    return {
      ok: false,
      health: last ? "fallback" : "unavailable",
      data: last,
      fetchedAt: new Date().toISOString(),
      error: message,
    };
  }
}

/**
 * Five minutes, not one. The IOC service returns a fixed ~2,100 rows for any
 * requested window, so a shorter window buys finer time resolution rather
 * than a smaller payload — every poll costs roughly 130 kB per station
 * regardless. The head moves by centimetres over hours, so this still
 * heavily oversamples the signal.
 */
export function seaLevelPollMs(): number {
  return envNumber("SEA_LEVEL_POLL_MS", 300_000);
}
