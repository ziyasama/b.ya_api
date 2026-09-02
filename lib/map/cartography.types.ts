/** Minimal GeoJSON shapes used by the static map renderer. */

export type MapLonLat = [number, number];

export type MapPolygon = {
  type: "Polygon";
  coordinates: MapLonLat[][];
};

export type MapMultiPolygon = {
  type: "MultiPolygon";
  coordinates: MapLonLat[][][];
};

export type MapLineString = {
  type: "LineString";
  coordinates: MapLonLat[];
};

export type MapMultiLineString = {
  type: "MultiLineString";
  coordinates: MapLonLat[][];
};

export type MapGeometry =
  | MapPolygon
  | MapMultiPolygon
  | MapLineString
  | MapMultiLineString;

export type MapFeature = {
  type: "Feature";
  geometry: MapGeometry | null;
  properties: Record<string, unknown>;
};

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: MapFeature[];
};
