import { createAdminSupabase } from "@/lib/supabase/admin";
import { envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import type { AisVesselRaw } from "@/lib/fetchers/types";
import type { VesselPositionRow } from "@/lib/supabase/database.types";

/**
 * Durable vessel roster. AISStream is event-driven, so a fresh worker sees an
 * empty strait for several minutes and used to write vessel_data = [] as
 * though the Bosphorus were deserted. Persisting the roster lets a restart
 * pick up where the previous process left off.
 *
 * Worker-only: this uses the service role key and must never reach the client
 * bundle, which is why it is not exported from lib/fetchers.
 */

function staleMs(): number {
  return envNumber("AIS_STALE_MS", 900_000);
}

export async function loadRoster(): Promise<AisVesselRaw[]> {
  const supabase = createAdminSupabase();
  const cutoff = new Date(Date.now() - staleMs()).toISOString();
  const { data, error } = await supabase
    .from("vessel_positions")
    .select("*")
    .gte("last_seen", cutoff);

  if (error) {
    log.warn("vessels.load.failed", { error: error.message });
    return [];
  }

  const rows = (data ?? []) as VesselPositionRow[];
  log.info("vessels.loaded", { count: rows.length });
  return rows.map((row) => ({
    mmsi: row.mmsi,
    lat: row.lat,
    lon: row.lon,
    size: row.size,
    shipName: row.ship_name,
    shipType: row.ship_type,
    lastSeen: row.last_seen,
  }));
}

export async function saveRoster(vessels: AisVesselRaw[]): Promise<void> {
  if (!vessels.length) return;
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const rows = vessels.map((v) => ({
    mmsi: v.mmsi,
    lat: v.lat,
    lon: v.lon,
    size: v.size,
    ship_name: v.shipName,
    ship_type: v.shipType,
    last_seen: v.lastSeen,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("vessel_positions")
    .upsert(rows, { onConflict: "mmsi" });

  if (error) {
    log.warn("vessels.save.failed", { error: error.message, count: rows.length });
    return;
  }
  log.debug("vessels.saved", { count: rows.length });
}
