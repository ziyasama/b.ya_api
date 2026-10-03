import { OscPage } from "@/components/OscPage";
import { oscCadence } from "@/lib/osc-panel/cadence";
import { createServerSupabase } from "@/lib/supabase/server";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

export const dynamic = "force-dynamic";

export default async function OscRoute() {
  let initial: BosphorusState | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("bosphorus_state_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) initial = rowToState(data);
  } catch {
    initial = null;
  }

  return <OscPage initial={initial} cadence={oscCadence()} />;
}
