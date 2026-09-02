"use client";

import { useEffect, useState } from "react";
import { BosphorusScanMap } from "@/components/map/BosphorusScanMap";
import { MetricCard } from "@/components/MetricCard";
import { RadioListen } from "@/components/RadioListen";
import { SourceStatusPills } from "@/components/SourceStatusPills";
import { VesselList } from "@/components/VesselList";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusGeo } from "@/lib/map/geo";
import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

function MetricNote({
  source,
  children,
}: {
  source: string;
  children: string;
}) {
  return (
    <div className="px-1 sm:px-0">
      <p className="font-mono text-xs uppercase tracking-wider text-cyan">
        {source}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {children}
      </p>
    </div>
  );
}

function windNote(source: string | null | undefined): string {
  if (source === "metar") {
    return "Istanbul airport anemometers, 15–25 km inland. Median of LTFM, LTBA and LTFJ.";
  }
  if (source === "model") {
    return "Forecast model — METAR unavailable, expect an underread.";
  }
  return "Wind unavailable.";
}

function windDirNote(source: string | null | undefined): string {
  if (source === "metar") {
    return "Same airport anemometers as wind speed. Circular mean, so 350° and 10° do not average to south.";
  }
  if (source === "model") {
    return "Forecast model direction — METAR unavailable.";
  }
  return "Wind direction unavailable.";
}

function windSourceLabel(source: string | null | undefined): string {
  if (source === "metar") return "METAR · measured";
  if (source === "model") return "Open-Meteo · modelled";
  return "Wind · unavailable";
}

function waveNote(current: BosphorusState | null): string {
  const cell =
    current?.sampleLat != null
      ? ` (cell ${current.sampleLat.toFixed(2)}, ${current.sampleLon?.toFixed(2)})`
      : "";
  return `Modelled at the northern mouth${cell}. The wave model has no cell inside the strait, so this is the open Black Sea water that then flows south.`;
}

export function DashboardLive({
  initial,
  geo,
  cartoApiKey,
  radioUrl,
}: {
  initial: BosphorusState | null;
  geo: BosphorusGeo;
  cartoApiKey?: string;
  radioUrl: string;
}) {
  const [current, setCurrent] = useState<BosphorusState | null>(initial);
  const [previous, setPrevious] = useState<BosphorusState | null>(null);
  const [live, setLive] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createBrowserSupabase> | null = null;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    const channel = supabase
      .channel("bosphorus_state_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bosphorus_state_logs" },
        (payload) => {
          const next = rowToState(payload.new as BosphorusStateRow);
          setCurrent((prev) => {
            setPrevious(prev);
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (!cancelled) setLive(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">
            Bosphorus
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Live state</h1>
          <p className="mt-1 text-xs text-muted">
            {current?.createdAt
              ? new Date(current.createdAt).toLocaleString()
              : "Waiting for first log row"}
            {live ? " · realtime" : " · connecting"}
          </p>
        </div>
        <RadioListen url={radioUrl} />
      </header>

      <SourceStatusPills
        status={current?.sourceStatus ?? null}
        showingMap={showMap}
        onToggle={() => setShowMap((v) => !v)}
      />

      {showMap ? (
        <BosphorusScanMap
          geo={geo}
          vessels={current?.vesselData ?? []}
          cartoApiKey={cartoApiKey}
          compact
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(11rem,13.5rem)_1fr] sm:items-center sm:gap-x-6 sm:gap-y-3">
            <p className="hidden font-mono text-xs uppercase tracking-widest text-muted sm:block">
              Reading
            </p>
            <p className="hidden font-mono text-xs uppercase tracking-widest text-muted sm:block">
              Where it comes from
            </p>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Wind"
                value={current?.available.wind ? current.windSpeed : null}
                previous={previous?.windSpeed ?? null}
                unit="m/s"
              />
              <MetricNote source={windSourceLabel(current?.windSource)}>
                {windNote(current?.windSource)}
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Wave"
                value={current?.available.wave ? current.waveHeight : null}
                previous={previous?.waveHeight ?? null}
                unit="m"
              />
              <MetricNote source="Open-Meteo marine · modelled">
                {waveNote(current)}
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Sea level head"
                value={current?.available.seaLevel ? current.seaLevelHead : null}
                previous={previous?.seaLevelHead ?? null}
                unit="m"
              />
              <MetricNote source="IOC tide gauges · derived">
                Black Sea minus Marmara, from tide gauges; positive drives water south. Not a current in m/s.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Water temp"
                value={current?.available.seaSurfaceTemp ? current.seaSurfaceTemp : null}
                previous={previous?.seaSurfaceTemp ?? null}
                unit="°C"
              />
              <MetricNote source="Open-Meteo marine · modelled">
                Sea surface temperature from the same northern-mouth cell as the waves. Tide gauges have no thermistor; this is the water that then flows south through the strait.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Wave period"
                value={current?.wavePeriod ?? null}
                previous={previous?.wavePeriod ?? null}
                unit="s"
              />
              <MetricNote source="Open-Meteo marine · modelled">
                Seconds between crests in that Black Sea cell — not inside the strait. A short period is chop; a longer one is swell riding in from open water.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Swell"
                value={current?.swellHeight ?? null}
                previous={previous?.swellHeight ?? null}
                unit="m"
              />
              <MetricNote source="Open-Meteo marine · modelled">
                Swell height at the northern mouth. Distant weather's leftover energy, distinct from the local wind sea.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Wind dir"
                value={current?.windDirection ?? null}
                previous={previous?.windDirection ?? null}
                unit="°"
              />
              <MetricNote source={windSourceLabel(current?.windSource)}>
                {windDirNote(current?.windSource)}
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Black Sea"
                value={current?.seaLevelBlackSea ?? null}
                previous={previous?.seaLevelBlackSea ?? null}
                unit="m"
              />
              <MetricNote source="IOC · Şile tide gauge">
                Anomaly at the Black Sea end, not the raw waterline. Each station is compared to its own rolling mean so differing local datums do not fight.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Vessels"
                value={current?.available.vessels ? current.vesselCount : null}
                previous={previous?.vesselCount ?? null}
                unit=""
              />
              <MetricNote source="AISStream · measured">
                Live AIS roster in the strait. A silent feed is treated as unavailable, not as an empty Bosphorus — ships take a few minutes to check in.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Northbound"
                value={current?.available.vessels ? current.northboundCount : null}
                previous={previous?.northboundCount ?? null}
                unit=""
              />
              <MetricNote source="AIS · derived">
                Ships whose last latitude change was north, toward the Black Sea. A vessel with only one fix has no transit yet.
              </MetricNote>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:contents">
              <MetricCard
                label="Southbound"
                value={current?.available.vessels ? current.southboundCount : null}
                previous={previous?.southboundCount ?? null}
                unit=""
              />
              <MetricNote source="AIS · derived">
                Ships whose last latitude change was south, toward the Marmara.
              </MetricNote>
            </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">
          Traffic
        </h2>
        <VesselList vessels={current?.vesselData ?? []} />
      </section>
    </div>
  );
}
