import { BOSPHORUS } from "@/lib/env";

/** A ship last reported inside the strait, not out in the Marmara or Black Sea approaches. */
export function inStrait(lat: number, lon: number): boolean {
  return (
    lat >= BOSPHORUS.latMin() &&
    lat <= BOSPHORUS.latMax() &&
    lon >= BOSPHORUS.lonMin() &&
    lon <= BOSPHORUS.lonMax()
  );
}

export function straitCounts(
  vessels: Array<{ lat: number; lon: number; transit?: "northbound" | "southbound" | null }>,
): { total: number; northbound: number; southbound: number } {
  let northbound = 0;
  let southbound = 0;
  let total = 0;
  for (const vessel of vessels) {
    if (!inStrait(vessel.lat, vessel.lon)) continue;
    total += 1;
    if (vessel.transit === "northbound") northbound += 1;
    else if (vessel.transit === "southbound") southbound += 1;
  }
  return { total, northbound, southbound };
}

/** Ships inside the strait first. Order within each group stays as given. */
export function straitFirst<T extends { lat: number; lon: number }>(vessels: readonly T[]): T[] {
  return [...vessels].sort(
    (a, b) => Number(inStrait(b.lat, b.lon)) - Number(inStrait(a.lat, a.lon)),
  );
}
