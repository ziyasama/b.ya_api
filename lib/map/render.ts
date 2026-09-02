import type { BoundingBox } from "@/lib/map/geo";
import type { MapFeatureCollection, MapLonLat } from "@/lib/map/cartography.types";
import { projectLonLat, ringPath } from "@/lib/map/projection";

function linePath(
  coords: MapLonLat[],
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string {
  if (!coords.length) return "";
  const [firstLon, firstLat] = coords[0];
  const first = projectLonLat(firstLon, firstLat, bounds, width, height, padding);
  const rest = coords
    .slice(1)
    .map(([lon, lat]) => {
      const { x, y } = projectLonLat(lon, lat, bounds, width, height, padding);
      return `L ${x} ${y}`;
    })
    .join(" ");
  return `M ${first.x} ${first.y} ${rest}`;
}

function polygonPaths(
  geometry: { type: "Polygon"; coordinates: MapLonLat[][] } | { type: "MultiPolygon"; coordinates: MapLonLat[][][] },
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string[] {
  if (geometry.type === "Polygon") {
    const d = geometry.coordinates
      .map((ring) => ringPath(ring, bounds, width, height, padding))
      .join(" ");
    return d ? [d] : [];
  }

  return geometry.coordinates
    .map((poly) =>
      poly.map((ring) => ringPath(ring, bounds, width, height, padding)).join(" "),
    )
    .filter(Boolean);
}

function linePaths(
  geometry:
    | { type: "LineString"; coordinates: MapLonLat[] }
    | { type: "MultiLineString"; coordinates: MapLonLat[][] },
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string[] {
  if (geometry.type === "LineString") {
    const d = linePath(geometry.coordinates, bounds, width, height, padding);
    return d ? [d] : [];
  }

  return geometry.coordinates
    .map((line) => linePath(line, bounds, width, height, padding))
    .filter(Boolean);
}

export function landPathsFromCollection(
  collection: MapFeatureCollection,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string[] {
  const paths: string[] = [];
  for (const feature of collection.features) {
    const { geometry } = feature;
    if (!geometry) continue;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      paths.push(...polygonPaths(geometry, bounds, width, height, padding));
    }
  }
  return paths;
}

export function coastlinePathsFromCollection(
  collection: MapFeatureCollection,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string[] {
  const paths: string[] = [];
  for (const feature of collection.features) {
    const { geometry } = feature;
    if (!geometry) continue;
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      paths.push(...linePaths(geometry, bounds, width, height, padding));
    }
  }
  return paths;
}

export const REGION_LABELS: [number, number, string][] = [
  [28.82, 41.32, "Black Sea"],
  [28.88, 40.9, "Sea of Marmara"],
  [29.055, 41.1, "Bosphorus"],
];
