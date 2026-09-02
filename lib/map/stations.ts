/** Fixed physical locations for data sources shown on the scan area map. */

export type MapStation = {
  id: string;
  label: string;
  lat: number;
  lon: number;
};

export const METAR_AIRPORTS: MapStation[] = [
  { id: "LTFM", label: "LTFM · Istanbul Airport", lat: 41.2753, lon: 28.7519 },
  { id: "LTBA", label: "LTBA · Atatürk", lat: 40.9761, lon: 28.8142 },
  { id: "LTFJ", label: "LTFJ · Sabiha Gökçen", lat: 40.8986, lon: 29.3092 },
];

export const TIDE_GAUGES: MapStation[] = [
  { id: "sile", label: "Şile · Black Sea", lat: 41.176, lon: 29.613 },
  { id: "yalo", label: "Yalova · Marmara", lat: 40.655, lon: 29.276 },
  { id: "igne", label: "İğneada · backup", lat: 41.874, lon: 27.984 },
  { id: "maer", label: "Marmara Ereğlisi · backup", lat: 40.97, lon: 27.95 },
];
