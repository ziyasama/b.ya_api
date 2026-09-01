import Link from "next/link";
import { BosphorusScanMap } from "@/components/map/BosphorusScanMap";
import { cartoApiKey } from "@/lib/env";
import { getBosphorusGeo } from "@/lib/map/geo";
import { createServerSupabase } from "@/lib/supabase/server";
import type { VesselRecord } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const geo = getBosphorusGeo();

  let vessels: VesselRecord[] = [];
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("bosphorus_state_logs")
      .select("vessel_data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    vessels = data?.vessel_data ?? [];
  } catch {
    vessels = [];
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">
            Bosphorus
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scan area map</h1>
          <p className="mt-1 text-xs text-muted">
            Where the worker scans for live data — documentation, not the OSC/MIDI output.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
        >
          ← Dashboard
        </Link>
      </header>

      <BosphorusScanMap geo={geo} vessels={vessels} cartoApiKey={cartoApiKey()} />
    </div>
  );
}
