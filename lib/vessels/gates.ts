/**
 * Virtual lines across the strait. These are not guessed latitudes: they are
 * the published Port of Istanbul boundaries, each a line between two working
 * lighthouses. A vessel whose track segment intersects one of these lines
 * has crossed that mouth.
 *
 * North: Rumeli Feneri — Anadolu Feneri.
 *   https://en.wikipedia.org/wiki/Rumeli_Feneri
 *   https://en.wikipedia.org/wiki/Anadolu_Feneri
 * South: Ahırkapı Feneri — Kadıköy İnciburnu Feneri.
 *   https://en.wikipedia.org/wiki/Ah%C4%B1rkap%C4%B1_Lighthouse
 *   https://en.wikipedia.org/wiki/Kad%C4%B1k%C3%B6y_%C4%B0nciburnu_Feneri
 */

export type LatLon = { lat: number; lon: number };

export type GateId = "north" | "south";

export type Gate = {
  id: GateId;
  /** Human label; the id is what gets stored. */
  name: string;
  a: LatLon;
  b: LatLon;
  source: string;
};

export const GATES: readonly Gate[] = [
  {
    id: "north",
    name: "Black Sea mouth",
    a: { lat: 41.23425, lon: 29.112083 }, // Rumeli Feneri
    b: { lat: 41.217472, lon: 29.152139 }, // Anadolu Feneri
    source: "Port of Istanbul northern boundary, Rumeli–Anadolu lighthouses",
  },
  {
    id: "south",
    name: "Marmara mouth",
    a: { lat: 41.0063306, lon: 28.9854306 }, // Ahırkapı Feneri
    b: { lat: 40.9925611, lon: 29.0148806 }, // Kadıköy İnciburnu Feneri
    source: "Port of Istanbul southern boundary, Ahırkapı–İnciburnu lighthouses",
  },
];
