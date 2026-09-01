import { DashboardLive } from "@/components/DashboardLive";
import { cartoApiKey } from "@/lib/env";
import { getBosphorusGeo } from "@/lib/map/geo";
import { createServerSupabase } from "@/lib/supabase/server";
import { rowToState } from "@/lib/standardize/row";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let initial = null;
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

  return (
    <DashboardLive
      initial={initial}
      geo={getBosphorusGeo()}
      cartoApiKey={cartoApiKey()}
    />
  );
}
