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
