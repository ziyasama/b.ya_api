import { createAdminSupabase } from "@/lib/supabase/admin";
import { vesselCountWindowMs } from "@/lib/env";
import { log } from "@/lib/logger";
import type { AisVesselRaw } from "@/lib/fetchers/types";
import type { VesselPositionRow } from "@/lib/supabase/database.types";
import type { GateCrossing } from "@/lib/vessels/events";

/**
 * Durable vessel roster. A fresh worker used to write vessel_data = [] for
 * several minutes and publish the Bosphorus as deserted. Persisting the
 * roster lets a restart pick up where the previous process left off.
 *
 * Worker-only: this uses the service role key and must never reach the client
 * bundle, which is why it is not exported from lib/fetchers.
 */

function staleMs(): number {
  return vesselCountWindowMs();
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
    transit: null,
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

export async function saveEvents(events: GateCrossing[]): Promise<void> {
  if (!events.length) return;
  const supabase = createAdminSupabase();
  const rows = events.map((event) => ({
    mmsi: event.mmsi,
    ship_name: event.shipName,
    gate: event.gate,
    direction: event.direction,
    lat: event.lat,
    lon: event.lon,
    crossed_at: event.crossedAt,
  }));
  const { error } = await supabase.from("vessel_events").insert(rows);
  if (error) {
    const missing = /could not find the table|relation .* does not exist/i.test(
      error.message,
    );
    log.error("vessels.events.failed", {
      error: error.message,
      count: rows.length,
      hint: missing
        ? "run supabase/migrations/0003_vessel_events.sql in the Supabase SQL editor"
        : undefined,
    });
    return;
  }
  log.info("vessels.events.saved", {
    count: rows.length,
    gates: events.map((e) => `${e.mmsi}:${e.gate}:${e.direction}`),
  });
}
