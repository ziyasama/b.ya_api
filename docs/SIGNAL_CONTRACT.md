# Bosphorus signal contract

This is the document the composer works from. Values are only published when
they can be traced to an instrument, a named model cell, or a derived pair of
instruments. A missing source is never a calm sea.

## Continuous signals

Emitted by `npm run broadcast` on each new `bosphorus_state_logs` row (~120 s).
Normalized floats are 0.0–1.0. Availability is a separate 0.0/1.0 so a patch
can drop a voice instead of reading a normalized 0 as calm.

| OSC address | Meaning | Kind | Source | Notes |
| --- | --- | --- | --- | --- |
| `/bosphorus/wind/speed` | Wind speed | measured, else modelled | METAR LTFM/LTBA/LTFJ; Open-Meteo fallback | Anemometers 15–25 km inland. Model underread the strait by ~2× on 2 Sep 2026. |
| `/bosphorus/wind/direction` | Wind direction | same as speed | same | Degrees, 0–360 mapped to 0–1. |
| `/bosphorus/wave/height` | Significant wave height | modelled | Open-Meteo Marine cell 41.375, 29.125 | Not the strait. The wave model has no cell inside the Bosphorus. |
| `/bosphorus/wave/period` | Wave period | modelled | same cell | |
| `/bosphorus/wave/swell` | Swell height | modelled | same cell | |
| `/bosphorus/sea/temp` | Sea surface temperature | modelled | same cell | Gauges have no thermistor. |
| `/bosphorus/sea/head` | Black Sea minus Marmara sea level | measured / derived | IOC `sile` − `yalo` (backups `igne`, `maer`) | Signed. 0.5 is level. Positive drives surface water south. **Not a current in m/s.** |
| `/bosphorus/vessels/count` | Live AIS roster size | measured | AISStream | Warm-up empty is *unavailable*, not zero. |
| `/bosphorus/vessels/northbound` | Vessels whose last latitude change was north | derived from AIS | sign of Δlat | Null/omitted until a vessel has moved. |
| `/bosphorus/vessels/southbound` | Vessels whose last latitude change was south | derived from AIS | sign of Δlat | Toward the Marmara. |

Availability (0.0 or 1.0):

| OSC address | Flag |
| --- | --- |
| `/bosphorus/available/wind` | wind |
| `/bosphorus/available/wave` | wave |
| `/bosphorus/available/temp` | sea surface temperature |
| `/bosphorus/available/head` | sea level head |
| `/bosphorus/available/vessels` | AIS roster |

MIDI CC 1–10 follow the same order as the continuous table above. MIDI is for
the gallery Mac only.

## Discrete events

Emitted on `vessel_events` INSERT, as a bang (`1.0`), not a level.

| OSC address | Meaning |
| --- | --- |
| `/bosphorus/event/gate` | Any mouth crossing |
| `/bosphorus/event/gate/north` | Crossed Rumeli–Anadolu (Black Sea mouth) |
| `/bosphorus/event/gate/south` | Crossed Ahırkapı–İnciburnu (Marmara mouth) |

The two lines are the published Port of Istanbul boundaries, lighthouse to
lighthouse. Direction on the row is still the sign of the vessel's own
latitude change: northbound to the Black Sea, southbound to the Marmara.
No speed in m/s is attached.

MIDI CC 11 (north gate) and 12 (south gate) fire at 127 on a crossing.

## Patch slot

File: [`radio/patch/live.scd`](../radio/patch/live.scd)

The container boots [`radio/patch/boot.scd`](../radio/patch/boot.scd), which
opens UDP 57121 and loads `live.scd`. Replace `live.scd` and send:

```
/bosphorus/patch/reload  1.0
```

or restart the container. Restore the default with
`cp radio/patch/placeholder.scd radio/patch/live.scd`.

The placeholder is a slow bed from head, brightness from wind, noise texture
from wave height/period, register from temperature, and a noise ping on gate
bangs. It is meant to be replaced.

## What is not a signal

- `current_u` / `current_v` / salinity / density — retired, always null.
- Open-Meteo `ocean_current_velocity` — plausible but sampled from the same
  displaced Marmara cell as the old wave figure. Not wired.
- A vessel with only one position — no transit, no crossing.
