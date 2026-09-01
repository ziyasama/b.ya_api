import type { BosphorusGeo } from "@/lib/map/geo";
import type { VesselRecord } from "@/lib/supabase/database.types";
import { BosphorusMapView } from "@/components/map/BosphorusMapView";
import { MapLegend } from "@/components/map/MapLegend";
import { ScanStatusNotes } from "@/components/map/ScanStatusNotes";

function fmt(n: number): string {
  return n.toFixed(2);
}

export function BosphorusScanMap({
  geo,
  vessels,
  cartoApiKey,
  compact = false,
}: {
  geo: BosphorusGeo;
  vessels: VesselRecord[];
  cartoApiKey?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <BosphorusMapView
        geo={geo}
        vessels={vessels}
        cartoApiKey={cartoApiKey}
        className={
          compact
            ? "h-56 w-full overflow-hidden rounded-xl border border-border sm:h-72"
            : "h-64 w-full overflow-hidden rounded-xl border border-border sm:h-80 md:h-[440px]"
        }
      />

      <div className="rounded-xl border border-border bg-panel p-4 font-mono text-[11px] text-muted">
        <p className="mb-1.5 text-[11px] uppercase tracking-widest text-cyan">
          Bounding boxes (from lib/env.ts)
        </p>
        <p>
          Strait — SW [{fmt(geo.strait.swLat)}, {fmt(geo.strait.swLon)}] → NE [
          {fmt(geo.strait.neLat)}, {fmt(geo.strait.neLon)}]
        </p>
        <p>
          Approaches — SW [{fmt(geo.approaches.swLat)}, {fmt(geo.approaches.swLon)}] →
          NE [{fmt(geo.approaches.neLat)}, {fmt(geo.approaches.neLon)}]
        </p>
        <p>
          Sample point — [{fmt(geo.point.lat)}, {fmt(geo.point.lon)}]
        </p>
        {vessels.length === 0 ? (
          <p className="mt-2 text-muted">No AIS positions yet.</p>
        ) : (
          <p className="mt-2 text-foreground">
            {vessels.length} vessel{vessels.length === 1 ? "" : "s"} from the latest
            logged snapshot.
          </p>
        )}
      </div>

      <MapLegend />
      <ScanStatusNotes compact={compact} />
    </div>
  );
}
