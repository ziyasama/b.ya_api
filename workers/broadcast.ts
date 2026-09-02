import { config } from "dotenv";
import { envNumber } from "@/lib/env";
import { log } from "@/lib/logger";
import { createBroadcaster } from "@/lib/osc-midi/broadcaster";
import { rowToState } from "@/lib/standardize/row";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusStateRow, VesselEventRow } from "@/lib/supabase/database.types";

config({ path: ".env.local" });
config();

/**
 * Local installation-machine process. Not for Railway.
 *
 * Live test checklist:
 * 1. Set OSC_MIDI_DRY_RUN=false, OSC_HOST/OSC_PORT for Max/SuperCollider/Ableton OSC.
 * 2. Confirm virtual MIDI port "Bosphorus Hub" appears in Audio MIDI Setup / Ableton.
 * 3. npm run broadcast
 * 4. Insert or wait for a bosphorus_state_logs row; watch CC 1–10 and /bosphorus/* addresses.
 * 5. Calibrate SIGNAL_MAP against the audio patch (Step 9).
 */
const broadcaster = createBroadcaster();
const supabase = createBrowserSupabase();
let lastId: string | null = null;
let pollTimer: NodeJS.Timeout | null = null;

async function emitLatest(): Promise<void> {
  const { data, error } = await supabase
    .from("bosphorus_state_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.warn("broadcast.poll.error", { error: error.message });
    return;
  }
  if (!data || data.id === lastId) return;
  lastId = data.id;
  broadcaster.emit(rowToState(data));
}

function main(): void {
  log.info("broadcast.start", {
    pollMs: envNumber("BROADCAST_POLL_MS", 10_000),
    dryRun: process.env.OSC_MIDI_DRY_RUN !== "false",
  });

  const channel = supabase
    .channel("bosphorus_broadcast")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "bosphorus_state_logs" },
      (payload) => {
        const row = payload.new as BosphorusStateRow;
        lastId = row.id;
        broadcaster.emit(rowToState(row));
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vessel_events" },
      (payload) => {
        broadcaster.emitCrossing(payload.new as VesselEventRow);
      },
    )
    .subscribe((status) => {
      log.info("broadcast.realtime", { status });
    });

  pollTimer = setInterval(() => {
    void emitLatest();
  }, envNumber("BROADCAST_POLL_MS", 10_000));
  void emitLatest();

  const shutdown = (signal: string) => {
    log.info("broadcast.shutdown", { signal });
    if (pollTimer) clearInterval(pollTimer);
    void supabase.removeChannel(channel);
    broadcaster.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
