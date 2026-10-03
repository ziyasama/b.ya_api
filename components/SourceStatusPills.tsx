import type { SourceStatus, SourceStatusEntry } from "@/lib/supabase/database.types";

const LABELS: Partial<Record<keyof SourceStatus, string>> = {
  metar: "METAR",
  seaLevel: "Tide gauges",
  ais: "AIS",
  openMeteo: "Open-Meteo",
};

const COLOR: Record<string, string> = {
  ok: "text-green border-green/40",
  fallback: "text-gold border-gold/40",
  unavailable: "text-muted border-border",
};

export function SourceStatusPill({
  sourceKey,
  entry,
}: {
  sourceKey: keyof SourceStatus;
  entry: SourceStatusEntry | undefined;
}) {
  const label = LABELS[sourceKey];
  if (!label || !entry) return null;

  return (
    <span
      title={entry.error ?? entry.fetchedAt}
      className={`shrink-0 rounded-md border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${COLOR[entry.health] ?? COLOR.unavailable}`}
    >
      {label} · {entry.health}
    </span>
  );
}
