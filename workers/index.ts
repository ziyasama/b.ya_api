import { config } from "dotenv";
import { envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { OpenWatersFetcher, aisSnapshotMs } from "@/lib/fetchers/openwaters";
import { fetchMetar, metarPollMs } from "@/lib/fetchers/metar";
import { fetchOpenMeteo, openMeteoPollMs } from "@/lib/fetchers/open-meteo";
import { fetchSeaLevel, seaLevelPollMs } from "@/lib/fetchers/sea-level";
import type {
  FetcherResult,
  MetarRaw,
  OpenMeteoRaw,
  SeaLevelRaw,
} from "@/lib/fetchers/types";
import { toBosphorusState } from "@/lib/standardize";
import { persistState } from "@/lib/standardize/persist";
import { loadRoster, saveEvents, saveRoster } from "@/lib/vessels/store";

config({ path: ".env.local" });
config();

const ais = new OpenWatersFetcher();

function pending<T>(what: string): FetcherResult<T> {
  return {
    ok: false,
    health: "unavailable",
    data: null,
    fetchedAt: new Date().toISOString(),
    error: `${what} not fetched yet`,
  };
}

let latestWeather = pending<OpenMeteoRaw>("open-meteo");
let latestMetar = pending<MetarRaw>("metar");
let latestSeaLevel = pending<SeaLevelRaw>("sea level");

const timers: NodeJS.Timeout[] = [];
let shuttingDown = false;

/** Supabase rejects with plain objects rather than Error, so instanceof is not enough. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** Each source polls on its own clock: sea level moves every few seconds, METAR every half hour. */
async function guarded(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    log.error(`worker.${name}.uncaught`, { error: messageOf(error) });
  }
}

async function persistCycle(): Promise<void> {
  if (shuttingDown) return;
  await guarded("persist", async () => {
    const state = toBosphorusState({
      openMeteo: latestWeather,
      ais: ais.snapshot(),
      metar: latestMetar,
      seaLevel: latestSeaLevel,
    });
    await persistState(state);
  });
}

async function rosterCycle(): Promise<void> {
  if (shuttingDown) return;
  await guarded("roster", async () => {
    await saveRoster(ais.roster());
  });
}

async function eventCycle(): Promise<void> {
  if (shuttingDown) return;
  await guarded("events", async () => {
    await saveEvents(ais.drainEvents());
  });
}

/**
 * Fetchers run immediately so the first row has something in it. The persist
 * and roster timers must not, because on boot they would fire before any
 * fetcher had returned and write an all-null row on every restart.
 */
function interval(fn: () => void, ms: number, immediate = true): NodeJS.Timeout {
  if (immediate) fn();
  const timer = setInterval(fn, ms);
  timers.push(timer);
  return timer;
}

async function main(): Promise<void> {
  const persistMs = envNumber("WORKER_PERSIST_MS", 120_000);
  log.info("worker.start", {
    weatherMs: openMeteoPollMs(),
    metarMs: metarPollMs(),
    seaLevelMs: seaLevelPollMs(),
    persistMs,
    aisSnapshotMs: aisSnapshotMs(),
  });

  // Seed the AIS roster before the first insert so a restart does not publish
  // an empty strait.
  await guarded("hydrate", async () => {
    ais.hydrate(await loadRoster());
  });

  ais.start();

  interval(() => {
    void guarded("weather", async () => {
      latestWeather = await fetchOpenMeteo();
    });
  }, openMeteoPollMs());

  interval(() => {
    void guarded("metar", async () => {
      latestMetar = await fetchMetar();
    });
  }, metarPollMs());

  interval(() => {
    void guarded("sea-level", async () => {
      latestSeaLevel = await fetchSeaLevel();
    });
  }, seaLevelPollMs());

  // First row after the opening fetches, then on the regular clock. Waiting
  // the full interval left the dashboard on the previous reading.
  const firstPersist = setTimeout(() => {
    void persistCycle();
  }, 20_000);
  timers.push(firstPersist);

  interval(() => {
    void persistCycle();
  }, persistMs, false);

  interval(() => {
    void rosterCycle();
  }, envNumber("VESSEL_ROSTER_SAVE_MS", 120_000), false);

  interval(() => {
    void eventCycle();
  }, envNumber("VESSEL_EVENT_FLUSH_MS", 10_000), false);
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("worker.shutdown", { signal });
  ais.stop();
  for (const timer of timers) clearInterval(timer);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  log.error("worker.uncaughtException", { error: error.message });
});
process.on("unhandledRejection", (reason) => {
  log.error("worker.unhandledRejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

void main();
