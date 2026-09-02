import { DashboardLive } from "@/components/DashboardLive";
import { radioStreamUrl } from "@/lib/env";
import {
  buildHistory,
  HISTORY_ROW_LIMIT,
  HISTORY_ROW_SELECT,
  HISTORY_WINDOW_MS,
  type HistoryRow,
  type MetricHistory,
} from "@/lib/history/metrics";
import { getBosphorusGeo } from "@/lib/map/geo";
import { createServerSupabase } from "@/lib/supabase/server";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initial: BosphorusState | null = null;
  let initialHistory: MetricHistory | undefined;
  try {
    const supabase = createServerSupabase();
    const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
    const [{ data }, { data: historyRows }] = await Promise.all([
      supabase
        .from("bosphorus_state_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("bosphorus_state_logs")
        .select(HISTORY_ROW_SELECT)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(HISTORY_ROW_LIMIT),
    ]);
    if (data) initial = rowToState(data);
    if (historyRows?.length) {
      initialHistory = buildHistory(historyRows as HistoryRow[]);
    }
  } catch {
    initial = null;
  }

  return (
    <DashboardLive
      initial={initial}
      initialHistory={initialHistory}
      geo={getBosphorusGeo()}
      radioUrl={radioStreamUrl()}
    />
  );
}
