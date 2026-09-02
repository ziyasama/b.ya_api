import { config } from "dotenv";
import { fetchMetar } from "@/lib/fetchers/metar";
import { fetchOpenMeteo } from "@/lib/fetchers/open-meteo";
import { fetchSeaLevel } from "@/lib/fetchers/sea-level";
import { toBosphorusState } from "@/lib/standardize";
import { BOSPHORUS } from "@/lib/env";

config({ path: ".env.local" });
config();

/**
 * Checks every keyless source against reality and prints what it returned.
 *
 * Exists because the dashboard spent weeks showing a 0.04 m wave height from
 * a grid cell 9 km outside the strait, and nothing in the pipeline would have
 * caught it. Run this whenever a number looks wrong.
 *
 *   npm run check:sources
 */

function line(label: string, value: unknown, unit = ""): void {
  const shown = value == null ? "— none —" : `${value}${unit ? ` ${unit}` : ""}`;
  console.log(`  ${label.padEnd(22)} ${shown}`);
}

async function main(): Promise<void> {
  console.log("\nMEASURED — wind from airport anemometers (METAR)");
  const metar = await fetchMetar();
  console.log(`  status: ${metar.health}${metar.ok ? "" : ` (${metar.error})`}`);
  if (metar.data) {
    line("wind speed", metar.data.windSpeed?.toFixed(2), "m/s");
    line("wind direction", metar.data.windDirection?.toFixed(0), "deg");
    line("air temp", metar.data.airTemp, "C");
    line("stations used", metar.data.stations.join(", "));
    line("observed at", metar.data.observedAt);
  }

  console.log("\nMEASURED — sea level from IOC tide gauges");
  const sea = await fetchSeaLevel();
  console.log(`  status: ${sea.health}${sea.ok ? "" : ` (${sea.error})`}`);
  if (sea.data) {
    for (const station of [sea.data.blackSea, sea.data.marmara]) {
      if (!station) continue;
      line(
        `${station.code} anomaly`,
        station.anomaly?.toFixed(3),
        `m (raw ${station.level?.toFixed(3)} m, ${station.samples} samples, at ${station.observedAt})`,
      );
    }
    line("HEAD, black sea - marmara", sea.data.head?.toFixed(3), "m");
  }

  console.log("\nMODELLED — waves and water temperature (Open-Meteo Marine)");
  const meteo = await fetchOpenMeteo();
  console.log(`  status: ${meteo.health}${meteo.ok ? "" : ` (${meteo.error})`}`);
  if (meteo.data) {
    line("wave height", meteo.data.waveHeight, "m");
    line("wave period", meteo.data.wavePeriod, "s");
    line("swell height", meteo.data.swellHeight, "m");
    line("water temp", meteo.data.seaSurfaceTemp, "C");
    line("model wind (fallback)", meteo.data.windSpeed?.toFixed(2), "m/s");

    const requested = `${BOSPHORUS.waveLat()}, ${BOSPHORUS.waveLon()}`;
    const used =
      meteo.data.sampleLat != null
        ? `${meteo.data.sampleLat.toFixed(4)}, ${meteo.data.sampleLon?.toFixed(4)}`
        : "unknown";
    console.log(`\n  requested cell:  ${requested}`);
    console.log(`  cell used:       ${used}`);

    if (meteo.data.sampleLat != null) {
      // A big snap means the model has no water where we asked, which is
      // exactly how the strait sample ended up in the Sea of Marmara.
      const dLat = meteo.data.sampleLat - BOSPHORUS.waveLat();
      const dLon = (meteo.data.sampleLon ?? 0) - BOSPHORUS.waveLon();
      const km = Math.hypot(dLat * 111, dLon * 111 * Math.cos((BOSPHORUS.waveLat() * Math.PI) / 180));
      console.log(`  displacement:    ${km.toFixed(1)} km`);
      if (km > 20) {
        console.log("  WARNING: the model snapped a long way. Check the sample point.");
      }
    }

    if ((meteo.data.waveHeight ?? 0) < 0.05 && (meteo.data.wavePeriod ?? 0) < 2.5) {
      console.log(
        "  WARNING: near-zero height with a very short period looks like a sheltered inshore cell.",
      );
    }
  }

  // Assemble the row the worker would write, without touching the database.
  // This is where wind picks measured over modelled and where availability
  // flags are decided, so it is worth seeing before an insert happens.
  const state = toBosphorusState({
    openMeteo: meteo,
    ais: {
      ok: false,
      health: "unavailable",
      data: null,
      fetchedAt: new Date().toISOString(),
      error: "not checked by this script",
    },
    metar,
    seaLevel: sea,
  });

  console.log("\nASSEMBLED STATE — what the worker would insert");
  line("wind used", state.windSpeed?.toFixed(2), `m/s via ${state.windSource}`);
  line("available", Object.entries(state.available)
    .map(([k, v]) => `${k}=${v ? "yes" : "NO"}`)
    .join("  "));
  console.log("\n  normalized (what OSC and MIDI receive):");
  for (const [key, value] of Object.entries(state.normalized)) {
    if (value === 0 && !["windSpeed", "waveHeight", "seaSurfaceTemp"].includes(key)) continue;
    console.log(`    ${key.padEnd(20)} ${value.toFixed(4)}`);
  }
  console.log("\n  provenance:");
  for (const [key, p] of Object.entries(state.provenance)) {
    console.log(`    ${key.padEnd(10)} ${p.kind.padEnd(9)} ${p.source} (${p.ageSeconds ?? "?"}s old)`);
  }

  console.log("\nAIS is not checked here: it needs a key and a live socket. Run npm run worker.\n");
}

void main();
