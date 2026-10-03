import { HISTORY_WINDOW_MS, type HistoryPoint } from "@/lib/history/metrics";
import type { TransitDirection } from "@/lib/vessels/events";
import type { GateId } from "@/lib/vessels/gates";

/**
 * A through-passage is counted when the ship clears the far mouth.
 * The strait is about 30 km; at the 10-knot limit that is under two hours
 * underway. Six hours still accepts a ship that slows between the lines,
 * and rejects a later visit paired with an old entry.
 */
export const MAX_TRANSIT_MS = 6 * 60 * 60 * 1000;

/** Completions inside this span are the activity reading. */
export const PASSAGE_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Chart samples, matching the state-log cadence. */
const SERIES_STEP_MS = 120_000;

export const CROSSING_SELECT = "mmsi, gate, direction, crossed_at";

/** How far back a chart of rolling passage counts has to read. */
export function passageHistorySince(now = Date.now()): string {
  return new Date(now - HISTORY_WINDOW_MS - PASSAGE_WINDOW_MS - MAX_TRANSIT_MS).toISOString();
}

/** How far back the live four-hour total has to read. */
export function passageCountSince(now = Date.now()): string {
  return new Date(now - PASSAGE_WINDOW_MS - MAX_TRANSIT_MS).toISOString();
}

export type Crossing = {
  mmsi: string;
  gate: GateId;
  direction: TransitDirection;
  crossedAt: string;
};

export type Passage = {
  mmsi: string;
  direction: TransitDirection;
  enteredAt: string;
  completedAt: string;
};

export type PassageCounts = {
  total: number;
  northbound: number;
  southbound: number;
};

type CrossingRow = {
  mmsi: string;
  gate: string;
  direction: string;
  crossed_at: string;
};

export function crossingFromRow(row: CrossingRow): Crossing | null {
  if (row.gate !== "north" && row.gate !== "south") return null;
  if (row.direction !== "northbound" && row.direction !== "southbound") return null;
  if (!row.mmsi || !row.crossed_at) return null;
  return {
    mmsi: row.mmsi,
    gate: row.gate,
    direction: row.direction,
    crossedAt: row.crossed_at,
  };
}

export function crossingsFromRows(rows: CrossingRow[]): Crossing[] {
  const crossings: Crossing[] = [];
  for (const row of rows) {
    const crossing = crossingFromRow(row);
    if (crossing) crossings.push(crossing);
  }
  return crossings;
}

export function appendCrossing(events: Crossing[], next: Crossing): Crossing[] {
  const duplicate = events.some(
    (event) =>
      event.mmsi === next.mmsi &&
      event.gate === next.gate &&
      event.direction === next.direction &&
      event.crossedAt === next.crossedAt,
  );
  if (duplicate) return events;
  return [...events, next];
}

export function retainCrossings(events: Crossing[], now = Date.now()): Crossing[] {
  const cutoff = Date.parse(passageHistorySince(now));
  return events.filter((event) => Date.parse(event.crossedAt) >= cutoff);
}

/**
 * Northbound enters at the Marmara line and leaves at the Black Sea line.
 * Southbound is the reverse. A repeated hit on the entry line keeps the
 * latest one. The opposite direction cancels an open entry.
 */
export function completedPassages(
  events: Crossing[],
  maxTransitMs = MAX_TRANSIT_MS,
): Passage[] {
  const byShip = new Map<string, Crossing[]>();
  for (const event of events) {
    const track = byShip.get(event.mmsi);
    if (track) track.push(event);
    else byShip.set(event.mmsi, [event]);
  }

  const passages: Passage[] = [];
  for (const [mmsi, track] of byShip) {
    track.sort((a, b) => Date.parse(a.crossedAt) - Date.parse(b.crossedAt));
    let northEntry: string | null = null;
    let southEntry: string | null = null;

    for (const event of track) {
      const at = Date.parse(event.crossedAt);
      if (!Number.isFinite(at)) continue;

      if (event.direction === "northbound") {
        southEntry = null;
        if (event.gate === "south") {
          northEntry = event.crossedAt;
          continue;
        }
        if (event.gate === "north" && northEntry) {
          const entered = Date.parse(northEntry);
          const gap = at - entered;
          if (gap > 0 && gap <= maxTransitMs) {
            passages.push({
              mmsi,
              direction: "northbound",
              enteredAt: northEntry,
              completedAt: event.crossedAt,
            });
          }
          northEntry = null;
        }
        continue;
      }

      northEntry = null;
      if (event.gate === "north") {
        southEntry = event.crossedAt;
        continue;
      }
      if (event.gate === "south" && southEntry) {
        const entered = Date.parse(southEntry);
        const gap = at - entered;
        if (gap > 0 && gap <= maxTransitMs) {
          passages.push({
            mmsi,
            direction: "southbound",
            enteredAt: southEntry,
            completedAt: event.crossedAt,
          });
        }
        southEntry = null;
      }
    }
  }

  passages.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  return passages;
}

/** Completions in (fromMs, toMs]. */
export function countPassages(passages: Passage[], fromMs: number, toMs: number): PassageCounts {
  let northbound = 0;
  let southbound = 0;
  for (const passage of passages) {
    const at = Date.parse(passage.completedAt);
    if (!(at > fromMs && at <= toMs)) continue;
    if (passage.direction === "northbound") northbound += 1;
    else southbound += 1;
  }
  return { total: northbound + southbound, northbound, southbound };
}

export function activityAt(
  events: Crossing[],
  now = Date.now(),
  windowMs = PASSAGE_WINDOW_MS,
): PassageCounts {
  return countPassages(completedPassages(events), now - windowMs, now);
}

export function activitySeries(
  events: Crossing[],
  now = Date.now(),
  windowMs = PASSAGE_WINDOW_MS,
  historyMs = HISTORY_WINDOW_MS,
): {
  current: PassageCounts;
  previous: PassageCounts;
  history: {
    total: HistoryPoint[];
    northbound: HistoryPoint[];
    southbound: HistoryPoint[];
  };
} {
  const passages = completedPassages(events);
  const total: HistoryPoint[] = [];
  const northbound: HistoryPoint[] = [];
  const southbound: HistoryPoint[] = [];

  for (let t = now - historyMs; t <= now; t += SERIES_STEP_MS) {
    const counts = countPassages(passages, t - windowMs, t);
    const iso = new Date(t).toISOString();
    total.push({ t: iso, v: counts.total });
    northbound.push({ t: iso, v: counts.northbound });
    southbound.push({ t: iso, v: counts.southbound });
  }

  return {
    current: countPassages(passages, now - windowMs, now),
    previous: countPassages(passages, now - SERIES_STEP_MS - windowMs, now - SERIES_STEP_MS),
    history: { total, northbound, southbound },
  };
}
