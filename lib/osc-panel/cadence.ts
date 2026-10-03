import { envNumber } from "@/lib/env";
import { metarPollMs } from "@/lib/fetchers/metar";
import { openMeteoPollMs } from "@/lib/fetchers/open-meteo";
import { seaLevelPollMs } from "@/lib/fetchers/sea-level";

function every(ms: number): string {
  if (ms % 3_600_000 === 0) {
    const hours = ms / 3_600_000;
    return hours === 1 ? "every hour" : `every ${hours} h`;
  }
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return minutes === 1 ? "every minute" : `every ${minutes} min`;
  }
  const seconds = Math.round(ms / 1000);
  return seconds === 1 ? "every second" : `every ${seconds} s`;
}

/** How often each OSC row is collected. Matches the worker clocks. */
export function oscCadence(): Record<string, string> {
  const metar = every(metarPollMs());
  const marine = every(openMeteoPollMs());
  const sea = every(seaLevelPollMs());
  const logged = every(envNumber("WORKER_PERSIST_MS", 120_000));
  const gates = every(envNumber("VESSEL_EVENT_FLUSH_MS", 10_000));

  return {
    windSpeed: `Collected ${metar}`,
    windDirection: `Collected ${metar}`,
    waveHeight: `Collected ${marine}`,
    wavePeriod: `Collected ${marine}`,
    swellHeight: `Collected ${marine}`,
    seaSurfaceTemp: `Collected ${marine}`,
    seaLevelHead: `Collected ${sea}`,
    seaLevelBlackSea: `Collected ${sea}`,
    vesselCount: `Live AIS, logged ${logged}`,
    northboundCount: `Live AIS, logged ${logged}`,
    southboundCount: `Live AIS, logged ${logged}`,
    gateNorth: `On crossing, saved ${gates}`,
    gateSouth: `On crossing, saved ${gates}`,
    gateAny: `On crossing, saved ${gates}`,
  };
}
