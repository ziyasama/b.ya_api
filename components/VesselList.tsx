import type { VesselRecord } from "@/lib/supabase/database.types";

export function VesselList({ vessels }: { vessels: VesselRecord[] }) {
  if (vessels.length === 0) {
    return <p className="text-sm text-muted">No vessels in the bounding box.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-panel">
      {vessels.slice(0, 12).map((vessel) => (
        <li
          key={vessel.mmsi}
          className="flex items-baseline justify-between gap-3 px-4 py-2 font-mono text-xs"
        >
          <span className="text-cyan">{vessel.mmsi}</span>
          <span className="truncate text-muted">
            {vessel.shipName ?? "unknown"}
          </span>
          <span>
            {vessel.lat.toFixed(3)}, {vessel.lon.toFixed(3)}
          </span>
        </li>
      ))}
    </ul>
  );
}
