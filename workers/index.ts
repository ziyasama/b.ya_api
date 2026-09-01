import { config } from "dotenv";
import { envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { AisStreamFetcher, aisSnapshotMs } from "@/lib/fetchers/aisstream";
import { fetchCmems, cmemsPollMs } from "@/lib/fetchers/cmems";
import { fetchOpenMeteo, openMeteoPollMs } from "@/lib/fetchers/open-meteo";
import type { FetcherResult, OpenMeteoRaw, CmemsRaw } from "@/lib/fetchers/types";
import { toBosphorusState } from "@/lib/standardize";
import { persistState } from "@/lib/standardize/persist";

config({ path: ".env.local" });
config();

const ais = new AisStreamFetcher();

let latestWeather: FetcherResult<OpenMeteoRaw> = {
  ok: false,
  health: "unavailable",
  data: null,
  fetchedAt: new Date().toISOString(),
  error: "not fetched yet",
};

let latestCmems: FetcherResult<CmemsRaw> = {
  ok: false,
  health: "unavailable",
  data: null,
  fetchedAt: new Date().toISOString(),
  error: "not fetched yet",
};

let weatherTimer: NodeJS.Timeout | null = null;
let cmemsTimer: NodeJS.Timeout | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

async function safeWeather(): Promise<void> {
  try {
    latestWeather = await fetchOpenMeteo();
  } catch (error) {
    log.error("worker.weather.uncaught", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function safeCmems(): Promise<void> {
  try {
    latestCmems = await fetchCmems();
  } catch (error) {
    log.error("worker.cmems.uncaught", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function persistCycle(): Promise<void> {
  if (shuttingDown) return;
  try {
    const state = toBosphorusState({
      openMeteo: latestWeather,
      ais: ais.snapshot(),
      cmems: latestCmems,
    });
    await persistState(state);
  } catch (error) {
    log.error("worker.persist.uncaught", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function interval(fn: () => void, ms: number): NodeJS.Timeout {
  fn();
  return setInterval(fn, ms);
}

async function main(): Promise<void> {
  log.info("worker.start", {
    weatherMs: openMeteoPollMs(),
    cmemsMs: cmemsPollMs(),
    persistMs: envNumber("WORKER_PERSIST_MS", 30_000),
    aisSnapshotMs: aisSnapshotMs(),
  });

  ais.start();
  weatherTimer = interval(() => {
    void safeWeather();
  }, openMeteoPollMs());
  cmemsTimer = interval(() => {
    void safeCmems();
  }, cmemsPollMs());
  persistTimer = interval(() => {
    void persistCycle();
  }, envNumber("WORKER_PERSIST_MS", 30_000));
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("worker.shutdown", { signal });
  ais.stop();
  if (weatherTimer) clearInterval(weatherTimer);
  if (cmemsTimer) clearInterval(cmemsTimer);
  if (persistTimer) clearInterval(persistTimer);
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
