import type { SourceStatus } from "@/lib/supabase/database.types";

/** Ordered measured-first, since that is the distinction that matters most. */
const LABELS: Array<{ key: keyof SourceStatus; label: string }> = [
  { key: "metar", label: "METAR" },
  { key: "seaLevel", label: "Tide gauges" },
  { key: "ais", label: "AIS" },
  { key: "openMeteo", label: "Open-Meteo" },
];

const COLOR: Record<string, string> = {
  ok: "text-cyan border-cyan/40",
  fallback: "text-gold border-gold/40",
  unavailable: "text-muted border-border",
};

export function SourceStatusPills({
  status,
  showingMap = false,
  onToggle,
}: {
  status: SourceStatus | null;
  showingMap?: boolean;
  onToggle?: () => void;
}) {
  if (!status) return null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex flex-wrap items-center justify-start gap-2">
        {LABELS.map(({ key, label }) => {
          const entry = status[key];
          if (!entry) return null;
          return (
            <span
              key={key}
              title={entry.error ?? entry.fetchedAt}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${COLOR[entry.health] ?? COLOR.unavailable}`}
            >
              {label} · {entry.health}
            </span>
          );
        })}
      </div>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={showingMap}
          title={
            showingMap
              ? "Showing scan area map — tap to show live state"
              : "Tap to show the scan area map"
          }
          className="rounded-full border border-white px-3 py-1 text-xs text-white hover:opacity-80"
        >
          {showingMap ? "← Live state" : "Scan area map →"}
        </button>
      )}
    </div>
  );
}
