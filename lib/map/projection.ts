import type { BoundingBox } from "@/lib/map/geo";

export type ProjectedPoint = { x: number; y: number };

/** Maps lon/lat into SVG coordinates; y increases downward. */
export function projectLonLat(
  lon: number,
  lat: number,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): ProjectedPoint {
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const x =
    padding + ((lon - bounds.swLon) / (bounds.neLon - bounds.swLon)) * innerW;
  const y =
    padding +
    ((bounds.neLat - lat) / (bounds.neLat - bounds.swLat)) * innerH;
  return { x, y };
}

function boxRing(box: BoundingBox): [number, number][] {
  return [
    [box.swLon, box.swLat],
    [box.neLon, box.swLat],
    [box.neLon, box.neLat],
    [box.swLon, box.neLat],
    [box.swLon, box.swLat],
  ];
}

export function boundingBoxPath(
  box: BoundingBox,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string {
  return ringPath(boxRing(box), bounds, width, height, padding);
}

export function ringPath(
  ring: [number, number][],
  bounds: BoundingBox,
  width: number,
  height: number,
  padding = 24,
): string {
  if (!ring.length) return "";
  const [firstLon, firstLat] = ring[0];
  const first = projectLonLat(firstLon, firstLat, bounds, width, height, padding);
  const rest = ring
    .slice(1)
    .map(([lon, lat]) => {
      const { x, y } = projectLonLat(lon, lat, bounds, width, height, padding);
      return `L ${x} ${y}`;
    })
    .join(" ");
  return `M ${first.x} ${first.y} ${rest} Z`;
}
