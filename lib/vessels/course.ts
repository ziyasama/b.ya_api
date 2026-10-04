import { BOSPHORUS, vesselCountWindowMs } from "@/lib/env";
import type { TransitDirection } from "@/lib/vessels/events";
import { inStrait } from "@/lib/vessels/inside";

/**
 * A couple of knots is a berth, not a transit. Same line as the docking
 * window in the AIS fetcher: the strait speed limit is 10 knots.
 */
export const UNDERWAY_SOG_KN = 3;

/**
 * How far off due north or due south still counts as along the strait.
 * The channel bends to about 45° at Rumeli Hisarı, so a bow pointed
 * northeast is still northbound. A beam course is a crossing to a berth.
 */
export const TRANSIT_CONE_DEG = 60;

/**
 * Sail an underway fix for as long as it still counts. Same clock as the
 * vessel window: the middle of the strait goes quiet on this feed, so a
 * ship that has entered stays inside until that window ends.
 */
export function courseCarryMs(): number {
  return vesselCountWindowMs();
}

/**
 * How close to the strait a quiet fix may be and still be walked in.
 * The southern approach is a straight northbound channel for about this
 * far. Further out, in the Marmara, ships turn, so a straight line would
 * invent a transit.
 */
export const MOUTH_APPROACH_NM = 2;

/** At anchor, moored, aground. These do not get walked forward. */
const HELD_NAV = new Set([1, 5, 6]);

export function readCourse(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // 360 and 511 are the AIS "not available" sentinels.
  if (value < 0 || value >= 360) return null;
  return value;
}

export function readNavStatus(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 15) return null;
  return value;
}

/** Course over ground when the ship is moving; heading only if course is missing. */
/** True inside the strait, or within a couple of miles of that rectangle. */
export function nearStrait(lat: number, lon: number): boolean {
  if (inStrait(lat, lon)) return true;
  const south = BOSPHORUS.latMin();
  const north = BOSPHORUS.latMax();
  const west = BOSPHORUS.lonMin();
  const east = BOSPHORUS.lonMax();
  const dLat = lat < south ? south - lat : lat > north ? lat - north : 0;
  const dLon = lon < west ? west - lon : lon > east ? lon - east : 0;
  const midLat = lat + (lat < south ? dLat : lat > north ? -dLat : 0);
  const nm = Math.hypot(dLat * 60, dLon * 60 * Math.cos((midLat * Math.PI) / 180));
  return nm <= MOUTH_APPROACH_NM;
}

export function courseOf(fix: { cog?: number | null; heading?: number | null }): number | null {
  if (fix.cog != null) return fix.cog;
  return fix.heading ?? null;
}

/**
 * Northbound toward the Black Sea, southbound toward the Marmara.
 * Under 3 knots, or a course within the beam, is not a transit.
 */
export function transitFromCourse(
  courseDeg: number | null,
  sog: number | null,
): TransitDirection | null {
  if (courseDeg == null || sog == null || sog < UNDERWAY_SOG_KN) return null;
  const toNorth = Math.min(courseDeg, 360 - courseDeg);
  if (toNorth <= TRANSIT_CONE_DEG) return "northbound";
  if (Math.abs(courseDeg - 180) <= TRANSIT_CONE_DEG) return "southbound";
  return null;
}

export type UnderwayFix = {
  lat: number;
  lon: number;
  lastSeen?: string;
  sog?: number | null;
  cog?: number | null;
  heading?: number | null;
  navStatus?: number | null;
  transit?: TransitDirection | null;
};

/**
 * Direction for one fix. Course wins over a latitude step, because the
 * strait bends and a single step can point the wrong way. A ship sitting
 * still, anchored, or moored is neither direction. `fallback` is the
 * latitude-step direction, used only when this fix has no course.
 */
export function resolveTransit(
  fix: UnderwayFix,
  fallback: TransitDirection | null,
): TransitDirection | null {
  if (fix.navStatus != null && HELD_NAV.has(fix.navStatus)) return null;
  const fromCourse = transitFromCourse(courseOf(fix), fix.sog ?? null);
  if (fromCourse) return fromCourse;
  if (fix.sog != null && fix.sog < UNDERWAY_SOG_KN) return null;
  return fallback;
}

/**
 * Where an underway ship is now, if its last radio fix is behind it.
 * The Bosphorus often goes quiet once a ship enters: the last point sits
 * at the Marmara mouth while the ship is already north of it. Walking the
 * fix along its course puts it back in the strait. If that line has already
 * left the far mouth, the ship stays inside until the count window ends —
 * the feed rarely reports the middle, so treating the exit as observed
 * erases traffic that is still there. A fix more than a couple of miles
 * from the strait is left where it was. The stored AIS point is not
 * rewritten; this is a copy for the published row.
 */
export function carryUnderway<T extends UnderwayFix>(fix: T, now = Date.now()): T {
  const course = courseOf(fix);
  const sog = fix.sog ?? null;
  const transit = resolveTransit(fix, fix.transit ?? null);
  const fromCourse = transitFromCourse(course, sog);
  const seen = fix.lastSeen ? Date.parse(fix.lastSeen) : NaN;
  const age = now - seen;
  const canSail =
    fromCourse != null &&
    transit === fromCourse &&
    course != null &&
    sog != null &&
    nearStrait(fix.lat, fix.lon) &&
    Number.isFinite(age) &&
    age >= 60_000 &&
    age <= courseCarryMs();

  if (!canSail || course == null || sog == null) {
    return transit === fix.transit ? fix : { ...fix, transit };
  }

  const nm = sog * (age / 3_600_000);
  const rad = (course * Math.PI) / 180;
  const lat = fix.lat + (nm * Math.cos(rad)) / 60;
  const cosLat = Math.cos((fix.lat * Math.PI) / 180);
  const lon = fix.lon + (cosLat === 0 ? 0 : (nm * Math.sin(rad)) / (60 * cosLat));
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ...fix, transit };
  const held = remainInStrait({ lat: fix.lat, lon: fix.lon }, { lat, lon });
  return { ...fix, lat: held.lat, lon: held.lon, transit };
}

/**
 * Last point of the sailed segment that is still inside the strait.
 * A segment that never enters is left at its end.
 */
function remainInStrait(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): { lat: number; lon: number } {
  if (inStrait(to.lat, to.lon)) return to;
  let last: { lat: number; lon: number } | null = inStrait(from.lat, from.lon)
    ? { lat: from.lat, lon: from.lon }
    : null;
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const point = {
      lat: from.lat + t * (to.lat - from.lat),
      lon: from.lon + t * (to.lon - from.lon),
    };
    if (inStrait(point.lat, point.lon)) last = point;
  }
  return last ?? to;
}
