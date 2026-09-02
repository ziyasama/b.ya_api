import coastlineData from "@/lib/map/bosphorus-coastline.json";
import landData from "@/lib/map/bosphorus-land.json";
import type { MapFeatureCollection } from "@/lib/map/cartography.types";

export const bosphorusLand = landData as unknown as MapFeatureCollection;
export const bosphorusCoastline = coastlineData as unknown as MapFeatureCollection;
