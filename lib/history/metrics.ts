import type { BosphorusStateRow } from "@/lib/supabase/database.types";

export const HISTORY_WINDOW_MS = 14_400_000;
/** PostgREST fetch cap — ~2 samples/min over the window, with headroom. */
export const HISTORY_ROW_LIMIT = Math.ceil(HISTORY_WINDOW_MS / 60_000) * 4;

export type MetricSeriesKey =
  | "windSpeed"
  | "windDirection"
  | "waveHeight"
  | "wavePeriod"
  | "swellHeight"
  | "seaSurfaceTemp"
  | "seaLevelHead"
  | "seaLevelBlackSea"
  | "vesselCount"
  | "northboundCount"
  | "southboundCount";

export type HistoryPoint = {
  t: string;
  v: number | null;
};

export type MetricHistory = Record<MetricSeriesKey, HistoryPoint[]>;

export type HistoryRow = Pick<
  BosphorusStateRow,
  | "created_at"
  | "wind_speed"
  | "wind_direction"
  | "wave_height"
  | "wave_period"
  | "swell_height"
  | "sea_surface_temp"
  | "sea_level_head"
  | "sea_level_black_sea"
  | "vessel_count"
  | "vessel_data"
>;

export const HISTORY_ROW_SELECT =
  "created_at, wind_speed, wind_direction, wave_height, wave_period, swell_height, sea_surface_temp, sea_level_head, sea_level_black_sea, vessel_count, vessel_data";

const METRIC_KEYS: MetricSeriesKey[] = [
  "windSpeed",
  "windDirection",
  "waveHeight",
  "wavePeriod",
  "swellHeight",
  "seaSurfaceTemp",
  "seaLevelHead",
  "seaLevelBlackSea",
  "vesselCount",
  "northboundCount",
  "southboundCount",
];

export function emptyHistory(): MetricHistory {
  return {
    windSpeed: [],
    windDirection: [],
    waveHeight: [],
    wavePeriod: [],
    swellHeight: [],
    seaSurfaceTemp: [],
    seaLevelHead: [],
    seaLevelBlackSea: [],
    vesselCount: [],
    northboundCount: [],
    southboundCount: [],
  };
}

function valuesFromRow(row: HistoryRow): Record<MetricSeriesKey, number | null> {
  const vessels = row.vessel_data ?? [];
  return {
    windSpeed: row.wind_speed,
    windDirection: row.wind_direction,
    waveHeight: row.wave_height,
    wavePeriod: row.wave_period,
    swellHeight: row.swell_height,
    seaSurfaceTemp: row.sea_surface_temp,
    seaLevelHead: row.sea_level_head,
    seaLevelBlackSea: row.sea_level_black_sea,
    vesselCount: row.vessel_count,
    northboundCount:
      row.vessel_count == null
        ? null
        : vessels.filter((v) => v.transit === "northbound").length,
    southboundCount:
      row.vessel_count == null
        ? null
        : vessels.filter((v) => v.transit === "southbound").length,
  };
}

function trimHistory(history: MetricHistory, now = Date.now()): MetricHistory {
  const cutoff = now - HISTORY_WINDOW_MS;
  const next = emptyHistory();
  for (const key of METRIC_KEYS) {
    next[key] = history[key].filter((point) => Date.parse(point.t) >= cutoff);
  }
  return next;
}

export function buildHistory(rows: HistoryRow[], now = Date.now()): MetricHistory {
  const cutoff = now - HISTORY_WINDOW_MS;
  const next = emptyHistory();
  const sorted = [...rows]
    .filter((row) => Date.parse(row.created_at) >= cutoff)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  for (const row of sorted) {
    const values = valuesFromRow(row);
    for (const key of METRIC_KEYS) {
      next[key].push({ t: row.created_at, v: values[key] });
    }
  }
  return next;
}

export function appendHistory(
  history: MetricHistory,
  row: HistoryRow,
  now = Date.now(),
): MetricHistory {
  const values = valuesFromRow(row);
  const next = emptyHistory();
  for (const key of METRIC_KEYS) {
    const series = [...history[key], { t: row.created_at, v: values[key] }];
    const last = series[series.length - 2];
    if (last && last.t === row.created_at) {
      series.splice(series.length - 2, 1);
    }
    next[key] = series;
  }
  return trimHistory(next, now);
}

export function seriesPoints(history: MetricHistory, key: MetricSeriesKey): HistoryPoint[] {
  return history[key];
}
