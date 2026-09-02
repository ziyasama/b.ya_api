"use client";

import { useEffect, useState } from "react";
import { BosphorusStaticMap } from "@/components/map/BosphorusStaticMap";
import { MetricCard } from "@/components/MetricCard";
import { RadioListen } from "@/components/RadioListen";
import {
  SourceStatusPill,
} from "@/components/SourceStatusPills";
import type { SourceStatus, SourceStatusEntry } from "@/lib/supabase/database.types";
import { VesselList } from "@/components/VesselList";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusGeo } from "@/lib/map/geo";
import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import {
  appendHistory,
  buildHistory,
  emptyHistory,
  HISTORY_ROW_LIMIT,
  HISTORY_ROW_SELECT,
  HISTORY_WINDOW_MS,
  seriesPoints,
  type HistoryRow,
  type MetricHistory,
} from "@/lib/history/metrics";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

function MetricNote({
  source,
  children,
  statusKey,
  statusEntry,
}: {
  source: string;
  children: string;
  statusKey?: keyof SourceStatus;
  statusEntry?: SourceStatusEntry;
}) {
  return (
    <div className="px-1 sm:px-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-wider text-cyan">
          {source}
        </p>
        {statusKey ? (
          <SourceStatusPill sourceKey={statusKey} entry={statusEntry} />
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {children}
      </p>
    </div>
  );
}

function MetricGroup({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <h3 className="shrink-0 font-mono text-xs uppercase tracking-[0.25em] text-foreground/80">
          {title}
        </h3>
        <div className="h-px flex-1 bg-foreground/25" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] sm:gap-3">
        {children}
      </div>
      <div className="min-w-0">{note}</div>
    </div>
  );
}

const METAR_AIRPORTS =
  "LTFM (Istanbul Airport), LTBA (Atatürk) and LTFJ (Sabiha Gökçen)";

const METAR_GLOSS =
  "Meteorological Aerodrome Report — the standard airport weather observation published for pilots";

const AIS_GLOSS =
  "Automatic Identification System — the international ship-tracking network vessels use to broadcast position, course, and identity by radio";

const AISSTREAM_GLOSS =
  "a service that relays live AIS transmissions from ships worldwide";

function windSourceLabel(source: string | null | undefined): string {
  if (source === "metar") return "METAR · measured";
  if (source === "model") return "Open-Meteo · modelled";
  return "Wind · unavailable";
}

function waveSampleLabel(current: BosphorusState | null): string {
  if (current?.sampleLat != null && current.sampleLon != null) {
    return `open Black Sea water off the northern mouth (${current.sampleLat.toFixed(2)}°N, ${current.sampleLon.toFixed(2)}°E)`;
  }
  return "open Black Sea water off the northern mouth";
}

function windGroupNote(source: string | null | undefined): string {
  if (source === "metar") {
    return `Real measurements from airport weather stations via METAR (${METAR_GLOSS}). Wind speed is the median across ${METAR_AIRPORTS}; they sit 15–25 km inland, not on the water, but capture the same wind system that reaches the strait. Wind direction is a circular average from the same stations (350° and 10° average to north, not south). Compass bearing: 0° north, 90° east, 180° south, 270° west.`;
  }
  if (source === "model") {
    return `Computer forecast from Open-Meteo (a free online weather model) at 10 m height — used only when airport METAR (${METAR_GLOSS}) are missing or too old. Models tend to underread strait wind; on 2 Sep 2026 the forecast showed about 3 m/s while anemometers read 5–6 m/s. Speed and direction share the same fallback.`;
  }
  return `No wind reading this cycle — neither live airport METAR (${METAR_GLOSS}) nor the Open-Meteo (online weather model) fallback returned a usable value.`;
}

function marineGroupNote(current: BosphorusState | null): string {
  const where = waveSampleLabel(current);
  return `All four readings come from the Open-Meteo (free online weather and marine forecast service) marine model at ${where}. The Bosphorus is narrower than the model grid, so there is no in-strait cell — we use open Black Sea water off the northern mouth, the sea that feeds the strait, instead of a sheltered Marmara inshore point that would read near zero. Wave is significant height (roughly the average of the highest third of waves). Wave period is seconds between crests — short is chop from local wind, long is swell from open water. Swell is long-period energy from distant storms, separate from the shorter wind-driven sea. Water temp is sea surface temperature; tide gauges measure height only and have no thermometer.`;
}

function seaLevelGroupNote(): string {
  return "IOC (Intergovernmental Oceanographic Commission sea level monitoring network) radar tide gauges on either side of the strait. Sea level head is the Black Sea minus Marmara anomaly (how far each gauge sits above or below its own recent average, not the raw chart waterline): Şile on the Black Sea coast minus Yalova on the Marmara side (İğneada and Marmara Ereğlisi are backups if a station goes quiet). Each gauge is compared to its own 24-hour average so local datums (local zero points) do not skew the comparison. Positive head means the Black Sea sits higher and surface water tends to flow south — a height difference in metres, not a current speed. Black Sea alone is Şile's anomaly — how much higher or lower than its recent average.";
}

function trafficGroupNote(): string {
  return `Live AIS (${AIS_GLOSS}). AISStream (${AISSTREAM_GLOSS}) counts ships in a box around the strait. Vessels is the total live count. Northbound and southbound split that roster by whether each ship's last two fixes moved toward the Black Sea or the Marmara; a ship seen only once has no direction yet and is not counted in either direction. During the first minute after connecting, an empty feed is treated as unavailable (a broken feed), not as zero ships, because vessels check in over several minutes.`;
}

export function DashboardLive({
  initial,
  initialHistory,
  geo,
  radioUrl,
}: {
  initial: BosphorusState | null;
  initialHistory?: MetricHistory;
  geo: BosphorusGeo;
  radioUrl: string;
}) {
  const [current, setCurrent] = useState<BosphorusState | null>(initial);
  const [previous, setPrevious] = useState<BosphorusState | null>(null);
  const [history, setHistory] = useState<MetricHistory>(() => initialHistory ?? emptyHistory());
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createBrowserSupabase> | null = null;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    const loadHistory = async () => {
      const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
      const { data, error } = await supabase!
        .from("bosphorus_state_logs")
        .select(HISTORY_ROW_SELECT)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(HISTORY_ROW_LIMIT);
      if (cancelled || error || !data) return;
      setHistory(buildHistory(data as HistoryRow[]));
    };

    if (!initialHistory) {
      void loadHistory();
    }

    const channel = supabase
      .channel("bosphorus_state_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bosphorus_state_logs" },
        (payload) => {
          const row = payload.new as BosphorusStateRow;
          const next = rowToState(row);
          setHistory((prev) => appendHistory(prev, row as HistoryRow));
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
            {" · logged every ~2 min"}
          </p>
        </div>
        <RadioListen url={radioUrl} />
      </header>

      <section className="flex flex-col gap-8">
        <BosphorusStaticMap geo={geo} />

        <MetricGroup
          title="Wind"
          note={
            <MetricNote
              source={windSourceLabel(current?.windSource)}
              statusKey="metar"
              statusEntry={current?.sourceStatus?.metar}
            >
              {windGroupNote(current?.windSource)}
            </MetricNote>
          }
        >
          <MetricCard
            label="Wind"
            value={current?.available.wind ? current.windSpeed : null}
            previous={previous?.windSpeed ?? null}
            unit="m/s"
            history={seriesPoints(history, "windSpeed")}
          />
          <MetricCard
            label="Wind dir"
            value={current?.windDirection ?? null}
            previous={previous?.windDirection ?? null}
            unit="°"
            history={seriesPoints(history, "windDirection")}
            compassDirection={current?.windDirection ?? null}
          />
        </MetricGroup>

        <MetricGroup
          title="Waves & surface"
          note={
            <MetricNote
              source="Open-Meteo marine · modelled"
              statusKey="openMeteo"
              statusEntry={current?.sourceStatus?.openMeteo}
            >
              {marineGroupNote(current)}
            </MetricNote>
          }
        >
          <MetricCard
            label="Wave"
            value={current?.available.wave ? current.waveHeight : null}
            previous={previous?.waveHeight ?? null}
            unit="m"
            history={seriesPoints(history, "waveHeight")}
          />
          <MetricCard
            label="Wave period"
            value={current?.wavePeriod ?? null}
            previous={previous?.wavePeriod ?? null}
            unit="s"
            history={seriesPoints(history, "wavePeriod")}
          />
          <MetricCard
            label="Swell"
            value={current?.swellHeight ?? null}
            previous={previous?.swellHeight ?? null}
            unit="m"
            history={seriesPoints(history, "swellHeight")}
          />
          <MetricCard
            label="Water temp"
            value={current?.available.seaSurfaceTemp ? current.seaSurfaceTemp : null}
            previous={previous?.seaSurfaceTemp ?? null}
            unit="°C"
            history={seriesPoints(history, "seaSurfaceTemp")}
          />
        </MetricGroup>

        <MetricGroup
          title="Sea level"
          note={
            <MetricNote
              source="IOC tide gauges · measured"
              statusKey="seaLevel"
              statusEntry={current?.sourceStatus?.seaLevel}
            >
              {seaLevelGroupNote()}
            </MetricNote>
          }
        >
          <MetricCard
            label="Sea level head"
            value={current?.available.seaLevel ? current.seaLevelHead : null}
            previous={previous?.seaLevelHead ?? null}
            unit="m"
            history={seriesPoints(history, "seaLevelHead")}
          />
          <MetricCard
            label="Black Sea"
            value={current?.seaLevelBlackSea ?? null}
            previous={previous?.seaLevelBlackSea ?? null}
            unit="m"
            history={seriesPoints(history, "seaLevelBlackSea")}
          />
        </MetricGroup>

        <MetricGroup
          title="Maritime traffic"
          note={
            <MetricNote
              source="AISStream · measured"
              statusKey="ais"
              statusEntry={current?.sourceStatus?.ais}
            >
              {trafficGroupNote()}
            </MetricNote>
          }
        >
          <MetricCard
            label="Vessels"
            value={current?.available.vessels ? current.vesselCount : null}
            previous={previous?.vesselCount ?? null}
            unit=""
            history={seriesPoints(history, "vesselCount")}
          />
          <MetricCard
            label="Northbound"
            value={current?.available.vessels ? current.northboundCount : null}
            previous={previous?.northboundCount ?? null}
            unit=""
            history={seriesPoints(history, "northboundCount")}
          />
          <MetricCard
            label="Southbound"
            value={current?.available.vessels ? current.southboundCount : null}
            previous={previous?.southboundCount ?? null}
            unit=""
            history={seriesPoints(history, "southboundCount")}
          />
        </MetricGroup>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">
          Traffic
        </h2>
        <VesselList vessels={current?.vesselData ?? []} />
      </section>
    </div>
  );
}
