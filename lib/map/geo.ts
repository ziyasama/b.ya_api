import { BOSPHORUS } from "@/lib/env";

/**
 * Server-only geometry for the /map route and the dashboard's embedded
 * scan map. Reads the exact same env accessors as
 * `lib/fetchers/aisstream.ts`, so if the AIS bounding boxes ever change in
 * `.env.local` / Railway variables, the map picks it up automatically —
 * nothing here is hand-copied.
 *
 * `process.env` is only readable on the server, so this must be called
 * from a Server Component and passed down as props; never import it from
 * a "use client" file.
 */

export type BoundingBox = {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
};

export type BosphorusGeo = {
  /** Tight AIS box: the strait itself. */
  strait: BoundingBox;
  /** Wider AIS box: Marmara -> strait -> Black Sea approaches. */
  approaches: BoundingBox;
  /** Open-Meteo / CMEMS sample point (Istanbul / Bosphorus). */
  point: { lat: number; lon: number };
};

export function getBosphorusGeo(): BosphorusGeo {
  return {
    strait: {
      swLat: BOSPHORUS.latMin(),
      swLon: BOSPHORUS.lonMin(),
      neLat: BOSPHORUS.latMax(),
      neLon: BOSPHORUS.lonMax(),
    },
    approaches: {
      swLat: BOSPHORUS.approachLatMin(),
      swLon: BOSPHORUS.approachLonMin(),
      neLat: BOSPHORUS.approachLatMax(),
      neLon: BOSPHORUS.approachLonMax(),
    },
    point: { lat: BOSPHORUS.lat(), lon: BOSPHORUS.lon() },
  };
}
