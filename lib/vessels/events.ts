import { GATES, type Gate, type GateId, type LatLon } from "@/lib/vessels/gates";

export type TransitDirection = "northbound" | "southbound";

export type VesselFix = LatLon & {
  mmsi: string;
  lastSeen: string;
  shipName?: string | null;
};

export type GateCrossing = {
  mmsi: string;
  shipName: string | null;
  gate: GateId;
  direction: TransitDirection;
  lat: number;
  lon: number;
  crossedAt: string;
};

/** Drops AIS jitter: ~33 m at this latitude. Below that, direction is unknown. */
export const MIN_MOVE_DEG = 0.0003;

/**
 * Skip crossing detection when the previous fix is this old. The vessel may
 * have left the box and come back; interpolating a straight line across that
 * gap would invent a crossing.
 */
export const MAX_GAP_MS = 15 * 60 * 1000;

export function transitDirection(prev: LatLon, curr: LatLon): TransitDirection | null {
  const dlat = curr.lat - prev.lat;
  const dlon = curr.lon - prev.lon;
  const meanLatRad = ((curr.lat + prev.lat) / 2) * (Math.PI / 180);
  const move = Math.hypot(dlat, dlon * Math.cos(meanLatRad));
  if (move < MIN_MOVE_DEG) return null;
  if (dlat === 0) return null;
  return dlat > 0 ? "northbound" : "southbound";
}

/**
 * Strict segment intersection in lon/lat. Locally planar is fine over a few
 * kilometres. Endpoints that merely touch the gate do not count: the vessel
 * has to change side.
 */
export function segmentIntersection(
  p: LatLon,
  q: LatLon,
  r: LatLon,
  s: LatLon,
): LatLon | null {
  const o1 = orient(p, q, r);
  const o2 = orient(p, q, s);
  const o3 = orient(r, s, p);
  const o4 = orient(r, s, q);
  if (o1 * o2 >= 0 || o3 * o4 >= 0) return null;
  const denom = (q.lat - p.lat) * (s.lon - r.lon) - (q.lon - p.lon) * (s.lat - r.lat);
  if (denom === 0) return null;
  const t = ((r.lat - p.lat) * (s.lon - r.lon) - (r.lon - p.lon) * (s.lat - r.lat)) / denom;
  return {
    lat: p.lat + t * (q.lat - p.lat),
    lon: p.lon + t * (q.lon - p.lon),
  };
}

function orient(a: LatLon, b: LatLon, c: LatLon): number {
  return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
}

export function detectCrossings(
  prev: VesselFix,
  curr: VesselFix,
  gates: readonly Gate[] = GATES,
): GateCrossing[] {
  const prevMs = Date.parse(prev.lastSeen);
  const currMs = Date.parse(curr.lastSeen);
  if (!Number.isFinite(prevMs) || !Number.isFinite(currMs)) return [];
  if (currMs - prevMs > MAX_GAP_MS || currMs < prevMs) return [];
  const direction = transitDirection(prev, curr);
  if (!direction) return [];

  const events: GateCrossing[] = [];
  for (const gate of gates) {
    const hit = segmentIntersection(prev, curr, gate.a, gate.b);
    if (!hit) continue;
    events.push({
      mmsi: curr.mmsi,
      shipName: curr.shipName ?? null,
      gate: gate.id,
      direction,
      lat: hit.lat,
      lon: hit.lon,
      crossedAt: curr.lastSeen,
    });
  }
  return events;
}
