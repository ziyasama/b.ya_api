"use client";

import { useEffect, useState } from "react";
import { Gauge } from "@/components/Gauge";
import { MetricCard } from "@/components/MetricCard";
import { SourceStatusPills } from "@/components/SourceStatusPills";
import { VesselList } from "@/components/VesselList";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusStateRow } from "@/lib/supabase/database.types";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

export function DashboardLive({ initial }: { initial: BosphorusState | null }) {
  const [current, setCurrent] = useState<BosphorusState | null>(initial);
  const [previous, setPrevious] = useState<BosphorusState | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabase();
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
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
          >
            Sign out
          </button>
        </form>
      </header>

      <SourceStatusPills status={current?.sourceStatus ?? null} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Gauge
          label="Wind"
          value={current?.windSpeed ?? null}
          unit="m/s"
          normalized={current?.normalized.windSpeed ?? 0}
        />
        <Gauge
          label="Wave"
          value={current?.waveHeight ?? null}
          unit="m"
          normalized={current?.normalized.waveHeight ?? 0}
        />
        <Gauge
          label="Current"
          value={
            current
              ? Math.hypot(current.currentU ?? 0, current.currentV ?? 0)
              : null
          }
          unit="m/s"
          normalized={current?.normalized.currentSpeed ?? 0}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="SST"
          value={current?.seaSurfaceTemp ?? null}
          previous={previous?.seaSurfaceTemp ?? null}
          unit="°C"
        />
        <MetricCard
          label="Salinity"
          value={current?.salinity ?? null}
          previous={previous?.salinity ?? null}
          unit="PSU"
        />
        <MetricCard
          label="Density"
          value={current?.waterDensity ?? null}
          previous={previous?.waterDensity ?? null}
          unit="kg/m³"
        />
        <MetricCard
          label="Current dir"
          value={current?.currentDirection ?? null}
          previous={previous?.currentDirection ?? null}
          unit="°"
        />
        <MetricCard
          label="U / V"
          value={current?.currentU ?? null}
          previous={previous?.currentU ?? null}
          unit="m/s"
        />
        <MetricCard
          label="Vessels"
          value={current?.vesselCount ?? null}
          previous={previous?.vesselCount ?? null}
          unit=""
        />
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
