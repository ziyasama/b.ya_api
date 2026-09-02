/**
 * Builds clipped Natural Earth GeoJSON for the static Bosphorus map.
 * Run: npm run map:build
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MapFeature, MapFeatureCollection, MapLonLat } from "@/lib/map/cartography.types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "lib/map");

/** Matches default BOSPHORUS_APPROACH_* env bounds. */
const BBOX = { swLon: 28.7, swLat: 40.85, neLon: 29.4, neLat: 41.4 };

const SOURCES = {
  land: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson",
  coastline:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson",
};

function featureBbox(feature: MapFeature): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords as MapLonLat;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const part of coords) visit(part);
  };

  if (feature.geometry) visit(feature.geometry.coordinates);
  if (!Number.isFinite(minLon)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function intersectsBbox(feature: MapFeature): boolean {
  const box = featureBbox(feature);
  if (!box) return false;
  const [minLon, minLat, maxLon, maxLat] = box;
  return !(
    maxLon < BBOX.swLon ||
    minLon > BBOX.neLon ||
    maxLat < BBOX.swLat ||
    minLat > BBOX.neLat
  );
}

function perpendicularDistance(point: MapLonLat, start: MapLonLat, end: MapLonLat): number {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

function douglasPeucker(points: MapLonLat[], tolerance: number): MapLonLat[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

function stripDuplicates(ring: MapLonLat[]): MapLonLat[] {
  const out: MapLonLat[] = [];
  for (const point of ring) {
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) out.push(point);
  }
  return out;
}

function simplifyRing(ring: MapLonLat[], tolerance: number): MapLonLat[] {
  return stripDuplicates(douglasPeucker(ring, tolerance)).map(([lon, lat]) => [
    Number(lon.toFixed(5)),
    Number(lat.toFixed(5)),
  ]);
}

function simplifyFeature(feature: MapFeature, tolerance: number): MapFeature {
  const geometry = feature.geometry;
  if (!geometry) return feature;

  switch (geometry.type) {
    case "Polygon":
      return {
        ...feature,
        geometry: {
          type: "Polygon",
          coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance)),
        },
      };
    case "MultiPolygon":
      return {
        ...feature,
        geometry: {
          type: "MultiPolygon",
          coordinates: geometry.coordinates.map((poly) =>
            poly.map((ring) => simplifyRing(ring, tolerance)),
          ),
        },
      };
    case "LineString":
      return {
        ...feature,
        geometry: {
          type: "LineString",
          coordinates: simplifyRing(geometry.coordinates, tolerance),
        },
      };
    case "MultiLineString":
      return {
        ...feature,
        geometry: {
          type: "MultiLineString",
          coordinates: geometry.coordinates.map((line) => simplifyRing(line, tolerance)),
        },
      };
    default:
      return feature;
  }
}

async function clip(url: string, tolerance: number): Promise<MapFeature[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  const collection = (await response.json()) as unknown as MapFeatureCollection;
  return collection.features
    .filter(intersectsBbox)
    .map((feature) => simplifyFeature(feature, tolerance));
}

async function main() {
  const [land, coastline] = await Promise.all([
    clip(SOURCES.land, 0.002),
    clip(SOURCES.coastline, 0.0008),
  ]);

  const landPath = join(OUT_DIR, "bosphorus-land.json");
  const coastPath = join(OUT_DIR, "bosphorus-coastline.json");

  writeFileSync(
    landPath,
    JSON.stringify({ type: "FeatureCollection", features: land } satisfies MapFeatureCollection),
  );
  writeFileSync(
    coastPath,
    JSON.stringify({
      type: "FeatureCollection",
      features: coastline,
    } satisfies MapFeatureCollection),
  );

  console.log(`Wrote ${land.length} land feature(s) → ${landPath}`);
  console.log(`Wrote ${coastline.length} coastline feature(s) → ${coastPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
