# Fetchers — raw output shapes (Step 3 checkpoint)

These are the TypeScript contracts consumed by `lib/standardize`. Fetchers never write to Supabase.

## Open-Meteo — `OpenMeteoRaw`

```ts
{
  windSpeed: number | null;      // m/s, 10 m
  windDirection: number | null;  // degrees
  waveHeight: number | null;     // m
  seaSurfaceTemp: number | null; // °C
}
```

## AISStream — `AisSnapshotRaw`

```ts
{
  vesselCount: number;
  vessels: Array<{
    mmsi: string;
    lat: number;
    lon: number;
    size: number | null;      // length A+B when static data seen
    shipName: string | null;
    shipType: number | null;
    lastSeen: string;         // ISO
  }>;
}
```

## CMEMS / EMODnet — `CmemsRaw`

```ts
{
  currentU: number | null;         // m/s eastward
  currentV: number | null;         // m/s northward
  salinity: number | null;         // PSU
  waterDensity: number | null;     // kg/m3
  seaSurfaceTemp: number | null;   // °C if present
}
```

CMEMS is unavailable until `CMEMS_ERDDAP_URL` (or toolbox-produced JSON) is configured. Product ID placeholder: `cmems_mod_med_phy_anfc_4.2km_P1H-m`.
