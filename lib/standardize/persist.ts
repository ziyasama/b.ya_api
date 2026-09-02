import { createAdminSupabase } from "@/lib/supabase/admin";
import type { BosphorusState } from "@/lib/standardize/types";
import { stateToRow } from "@/lib/standardize/row";
import { log } from "@/lib/logger";

export async function persistState(state: BosphorusState): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from("bosphorus_state_logs").insert(stateToRow(state));
  if (error) {
    // The 0002 columns have to exist before the worker can write a row, and
    // the Postgres message on its own does not say which migration is missing.
    const missingColumn = /column .* does not exist|Could not find the '.*' column/i.test(
      error.message,
    );
    log.error("persist.failed", {
      error: error.message,
      hint: missingColumn
        ? "run supabase/migrations/0002_measured_sources.sql in the Supabase SQL editor"
        : undefined,
    });
    throw error;
  }
  log.info("persist.ok", {
    vesselCount: state.vesselCount,
    northbound: state.northboundCount,
    southbound: state.southboundCount,
    windSpeed: state.windSpeed,
    windSource: state.windSource,
    seaLevelHead: state.seaLevelHead,
  });
}
