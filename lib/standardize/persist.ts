import { createAdminSupabase } from "@/lib/supabase/admin";
import type { BosphorusState } from "@/lib/standardize/types";
import { stateToRow } from "@/lib/standardize/row";
import { log } from "@/lib/logger";

export async function persistState(state: BosphorusState): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from("bosphorus_state_logs").insert(stateToRow(state));
  if (error) {
    log.error("persist.failed", { error: error.message });
    throw error;
  }
  log.info("persist.ok", {
    vesselCount: state.vesselCount,
    windSpeed: state.windSpeed,
  });
}
