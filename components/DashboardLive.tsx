"use client";

import { useEffect, useState } from "react";
import { BosphorusScanMap } from "@/components/map/BosphorusScanMap";
import { Gauge } from "@/components/Gauge";
import { MetricCard } from "@/components/MetricCard";
import { SourceStatusPills } from "@/components/SourceStatusPills";
import { VesselList } from "@/components/VesselList";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusGeo } from "@/lib/map/geo";
import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

export function DashboardLive({
  initial,
  geo,
  cartoApiKey,
}: {
  initial: BosphorusState | null;
  geo: BosphorusGeo;
  cartoApiKey?: string;
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
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Gauge
              label="Wind"
              value={current?.available.wind ? current.windSpeed : null}
              unit="m/s"
              normalized={current?.available.wind ? current.normalized.windSpeed : 0}
            />
            <Gauge
              label="Wave"
              value={current?.available.wave ? current.waveHeight : null}
              unit="m"
              normalized={current?.available.wave ? current.normalized.waveHeight : 0}
            />
            <Gauge
              label="Sea level head"
              value={current?.available.seaLevel ? current.seaLevelHead : null}
              unit="m"
              normalized={current?.available.seaLevel ? current.normalized.seaLevelHead : 0}
            />
          </section>

          <p className="-mt-2 font-mono text-[10px] leading-relaxed text-muted">
            {current?.windSource === "metar"
              ? "Wind measured at Istanbul airport anemometers."
              : current?.windSource === "model"
                ? "Wind from forecast model — METAR unavailable, expect an underread."
                : "Wind unavailable."}{" "}
            Waves modelled at the northern mouth
            {current?.sampleLat != null
              ? ` (cell ${current.sampleLat.toFixed(2)}, ${current.sampleLon?.toFixed(2)})`
              : ""}
            . Head is Black Sea minus Marmara, measured by tide gauges; positive
            drives water south.
          </p>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Water temp"
              value={current?.available.seaSurfaceTemp ? current.seaSurfaceTemp : null}
              previous={previous?.seaSurfaceTemp ?? null}
              unit="°C"
            />
            <MetricCard
              label="Wave period"
              value={current?.wavePeriod ?? null}
              previous={previous?.wavePeriod ?? null}
              unit="s"
            />
            <MetricCard
              label="Swell"
              value={current?.swellHeight ?? null}
              previous={previous?.swellHeight ?? null}
              unit="m"
            />
            <MetricCard
              label="Wind dir"
              value={current?.windDirection ?? null}
              previous={previous?.windDirection ?? null}
              unit="°"
            />
            <MetricCard
              label="Black Sea"
              value={current?.seaLevelBlackSea ?? null}
              previous={previous?.seaLevelBlackSea ?? null}
              unit="m"
            />
            <MetricCard
              label="Vessels"
              value={current?.available.vessels ? current.vesselCount : null}
              previous={previous?.vesselCount ?? null}
              unit=""
            />
            <MetricCard
              label="Northbound"
              value={current?.available.vessels ? current.northboundCount : null}
              previous={previous?.northboundCount ?? null}
              unit=""
            />
            <MetricCard
              label="Southbound"
              value={current?.available.vessels ? current.southboundCount : null}
              previous={previous?.southboundCount ?? null}
              unit=""
            />
          </section>
        </>
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
