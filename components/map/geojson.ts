import type { BosphorusGeo } from "@/lib/map/geo";
import type { VesselRecord } from "@/lib/supabase/database.types";

/**
 * Pure GeoJSON builders shared by the map component. Kept out of the
 * "use client" file so they're trivially unit-testable without touching
 * maplibre-gl or the DOM.
 */

export function boxPolygon(box: {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}): GeoJSON.Feature<GeoJSON.Polygon> {
  const { swLat, swLon, neLat, neLon } = box;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [swLon, swLat],
          [neLon, swLat],
          [neLon, neLat],
          [swLon, neLat],
          [swLon, swLat],
        ],
      ],
    },
  };
}

export function boxesGeoJson(geo: BosphorusGeo): {
  strait: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  approaches: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  labels: GeoJSON.FeatureCollection<GeoJSON.Point>;
  point: GeoJSON.FeatureCollection<GeoJSON.Point>;
} {
  return {
    strait: { type: "FeatureCollection", features: [boxPolygon(geo.strait)] },
    approaches: { type: "FeatureCollection", features: [boxPolygon(geo.approaches)] },
    labels: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { label: "STRAIT · tight box" },
          geometry: { type: "Point", coordinates: [geo.strait.swLon, geo.strait.neLat] },
        },
        {
          type: "Feature",
          properties: { label: "APPROACHES · wider box" },
          geometry: {
            type: "Point",
            coordinates: [geo.approaches.swLon, geo.approaches.neLat],
          },
        },
      ],
    },
    point: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { label: "OPEN-METEO / CMEMS SAMPLE" },
          geometry: { type: "Point", coordinates: [geo.point.lon, geo.point.lat] },
        },
      ],
    },
  };
}

export function vesselsGeoJson(
  vessels: VesselRecord[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: vessels
      .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon))
      .map((v) => ({
        type: "Feature",
        properties: {
          mmsi: v.mmsi,
          shipName: v.shipName ?? "unknown",
        },
        geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      })),
  };
}
