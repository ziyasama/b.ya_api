import type { BosphorusGeo } from "@/lib/map/geo";
import { BosphorusStaticMap } from "@/components/map/BosphorusStaticMap";
import { ScanStatusNotes } from "@/components/map/ScanStatusNotes";

function fmt(n: number): string {
  return n.toFixed(2);
}

export function BosphorusScanMap({
  geo,
  compact = false,
}: {
  geo: BosphorusGeo;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <BosphorusStaticMap geo={geo} compact={compact} />

      {!compact ? (
        <div className="rounded-xl border border-border bg-panel p-4 font-mono text-[11px] text-muted">
          <p className="mb-1.5 text-[11px] uppercase tracking-widest text-cyan">
            Sample points (from lib/env.ts)
          </p>
          <p>
            Wind fallback — [{fmt(geo.point.lat)}, {fmt(geo.point.lon)}]
          </p>
          <p>
            Marine sample — [{fmt(geo.wavePoint.lat)}, {fmt(geo.wavePoint.lon)}]
          </p>
        </div>
      ) : null}

      {!compact ? <ScanStatusNotes /> : null}
    </div>
  );
}
