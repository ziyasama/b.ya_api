# Fetchers — raw output shapes

These are the TypeScript contracts consumed by `lib/standardize`. Fetchers never write to Supabase.

Sources are grouped by how much they can be trusted, because the strait is
narrower than any available forecast grid cell and that distinction turned out
to matter. Run `npm run check:sources` to see what each one currently returns.

## Measured

### METAR — `MetarRaw`

Istanbul airport anemometers via the Aviation Weather Center. Free, keyless, no
registration. Median across reporting stations, so one quiet station cannot
swing the value; direction uses a circular mean because averaging 350° and 10°
arithmetically gives 180°.

```ts
{
  windSpeed: number | null;      // m/s, converted from knots
  windDirection: number | null;  // degrees, circular mean
  airTemp: number | null;        // °C
  stations: string[];            // which stations contributed
  observedAt: string | null;     // ISO
}
```

Observations older than `METAR_MAX_AGE_MS` are dropped rather than published as
current. Stations are 15 to 25 km from the strait — a real measurement of the
same weather system, not of the water surface.

### IOC Sea Level Monitoring — `SeaLevelRaw`

Radar tide gauges either side of the strait. Free, keyless.

```ts
{
  blackSea: { code, level, anomaly, samples, observedAt } | null;
  marmara:  { code, level, anomaly, samples, observedAt } | null;
  head: number | null;  // metres, blackSea.anomaly - marmara.anomaly
}
```

Gauges sit on differing local datums, so raw `level` values from two stations
cannot be subtracted. Each station is compared to its own rolling mean and only
`anomaly` is comparable. `head` is the physical driver of the strait's surface
flow: positive drives water south toward the Marmara.

The service returns a fixed ~2,100 rows for any requested window, so a shorter
window buys time resolution rather than a smaller payload.

### AISStream — `AisSnapshotRaw`

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

Event-driven: AISStream pushes only when a vessel transmits, so the roster
takes minutes to fill. Within `AIS_WARMUP_MS` of the subscription confirming,
an empty roster is reported as `unavailable` rather than as a count of zero,
because a silent feed is not an empty strait. The roster is also persisted to
`vessel_positions` and rehydrated on boot so a restart does not rebuild from
nothing.

Each new fix is compared to the previous one for that MMSI. The sign of the
latitude change is `transit` (`northbound` toward the Black Sea, `southbound`
toward the Marmara). A jump smaller than AIS jitter, or a gap longer than 15
minutes, is not a transit and is not a gate crossing. Crossings are detected
against the Port of Istanbul lighthouse lines (`lib/vessels/gates.ts`) and
written to `vessel_events`.

## Modelled

### Open-Meteo — `OpenMeteoRaw`

```ts
{
  windSpeed: number | null;      // m/s, 10 m — fallback only, behind METAR
  windDirection: number | null;  // degrees
  waveHeight: number | null;     // m
  wavePeriod: number | null;     // s
  waveDirection: number | null;  // degrees
  swellHeight: number | null;    // m
  seaSurfaceTemp: number | null; // °C
  sampleLat: number | null;      // cell the API actually used
  sampleLon: number | null;
}
```

Two things to know. Wind is a fallback: on 2 Sep 2026 the model reported
2.97 m/s at the strait while three anemometers read 5.1 to 6.2 m/s.

Waves and SST are **not** sampled at the strait. The wave model has no cell
inside the Bosphorus, so a strait request snaps roughly 9 km south into the Sea
of Marmara and returns 0.04 m with a 2-second period — a sheltered inshore
cell. The sample point is instead the nearest genuine cell, in open Black Sea
water off the northern mouth, which reads 0.4 m at 4.25 seconds and is also the
water that flows south through the strait. `sampleLat` and `sampleLon` record
the cell the API actually used so this class of error cannot hide again.

## Retired

`CmemsRaw` and `lib/fetchers/cmems.ts` were removed in September 2026 when the
signal set was simplified to wind, wave, current, water temperature and
vessels. `current_u`, `current_v`, `salinity` and `water_density` remain as
always-null columns; see `supabase/migrations/0002_measured_sources.sql`. The
validated `cmems_mod_blk_phy-cur_anfc_mrm-500m_PT1H-i` dataset is the route
back to a true in-strait velocity in m/s if that is ever wanted, at the cost of
a Python sidecar.
