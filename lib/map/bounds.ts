import type { BoundingBox, BosphorusGeo } from "@/lib/map/geo";
import { METAR_AIRPORTS, TIDE_GAUGES } from "@/lib/map/stations";

/** Matches default BOSPHORUS_APPROACH_* in .env.example — used by map:build. */
export const DEFAULT_APPROACHES: BoundingBox = {
  swLat: 40.85,
  swLon: 28.7,
  neLat: 41.4,
  neLon: 29.4,
};

/** Map framing anchor — keeps the strait near the centre after zoom-out padding. */
export const MAP_FOCAL = { lat: 41.05, lon: 29.0 };

/** Golden Horn (Haliç) — historic inlet west of the strait mouth. */
export const HALIC_BAY: { lat: number; lon: number }[] = [
  { lat: 41.05, lon: 28.935 },
  { lat: 41.025, lon: 28.975 },
  { lat: 41.0, lon: 28.965 },
];

const PRIMARY_TIDE_IDS = new Set(["sile", "yalo"]);

function unionExtent(
  box: BoundingBox,
  points: { lat: number; lon: number }[],
): BoundingBox {
  let { swLat, swLon, neLat, neLon } = box;
  for (const { lat, lon } of points) {
    swLat = Math.min(swLat, lat);
    swLon = Math.min(swLon, lon);
    neLat = Math.max(neLat, lat);
    neLon = Math.max(neLon, lon);
  }
  return { swLat, swLon, neLat, neLon };
}

/** Bounds around the strait focal point; panLeft shifts the view left on screen. */
function focalBounds(
  extent: BoundingBox,
  focal: { lat: number; lon: number },
  zoomOut = 0.025,
  panLeft = 0.04,
): BoundingBox {
  const halfLat =
    Math.max(focal.lat - extent.swLat, extent.neLat - focal.lat) + zoomOut;
  const halfLon =
    Math.max(focal.lon - extent.swLon, extent.neLon - focal.lon) + zoomOut;
  return {
    swLat: focal.lat - halfLat,
    swLon: focal.lon - halfLon + panLeft,
    neLat: focal.lat + halfLat,
    neLon: focal.lon + halfLon + panLeft,
  };
}

function mapAnchorPoints(geo: BosphorusGeo): { lat: number; lon: number }[] {
  const tideForBounds = TIDE_GAUGES.filter((s) => PRIMARY_TIDE_IDS.has(s.id));
  return [
    geo.point,
    geo.wavePoint,
    ...METAR_AIRPORTS.map(({ lat, lon }) => ({ lat, lon })),
    ...tideForBounds.map(({ lat, lon }) => ({ lat, lon })),
    ...HALIC_BAY,
  ];
}

/** SVG projection bounds: AIS scan boxes plus every on-map data source. */
export function mapDisplayBounds(
  geo: BosphorusGeo,
  zoomOut = 0.025,
  panLeft = 0.04,
): BoundingBox {
  const extent = unionExtent(geo.approaches, mapAnchorPoints(geo));
  return focalBounds(extent, MAP_FOCAL, zoomOut, panLeft);
}

/** Cartography clip box for `npm run map:build` (default env geometry). */
export function defaultCartographyBounds(
  zoomOut = 0.025,
  panLeft = 0.04,
): BoundingBox {
  return mapDisplayBounds(
    {
      strait: DEFAULT_APPROACHES,
      approaches: DEFAULT_APPROACHES,
      point: { lat: 41.04, lon: 29.01 },
      wavePoint: { lat: 41.375, lon: 29.125 },
    },
    zoomOut,
    panLeft,
  );
}

export function isWithinBounds(
  lon: number,
  lat: number,
  bounds: BoundingBox,
): boolean {
  return (
    lon >= bounds.swLon &&
    lon <= bounds.neLon &&
    lat >= bounds.swLat &&
    lat <= bounds.neLat
  );
}
