import type { SourceStatus } from "@/lib/supabase/database.types";

const LABELS: Record<keyof SourceStatus, string> = {
  openMeteo: "Open-Meteo",
  ais: "AIS",
  cmems: "CMEMS",
};

const COLOR: Record<string, string> = {
  ok: "text-cyan border-cyan/40",
  fallback: "text-gold border-gold/40",
  unavailable: "text-muted border-border",
};

export function SourceStatusPills({ status }: { status: SourceStatus | null }) {
  if (!status) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(LABELS) as Array<keyof SourceStatus>).map((key) => {
        const entry = status[key];
        return (
          <span
            key={key}
            title={entry.error ?? entry.fetchedAt}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${COLOR[entry.health] ?? COLOR.unavailable}`}
          >
            {LABELS[key]} · {entry.health}
          </span>
        );
      })}
    </div>
  );
}
