import { MetricSparkline } from "@/components/MetricSparkline";
import { TrendArrow } from "@/components/TrendArrow";
import type { HistoryPoint } from "@/lib/history/metrics";

export function MetricCard({
  label,
  value,
  previous,
  unit,
  history,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  unit: string;
  history?: HistoryPoint[];
}) {
  return (
    <div className="h-full rounded-xl border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-xl">
        {value == null ? "—" : Number.isInteger(value) ? value : value.toFixed(2)}
        <span className="ml-1 text-sm text-muted">{unit}</span>
      </p>
      <p className="mt-2 text-xs">
        <TrendArrow current={value} previous={previous} />
      </p>
      {history ? <MetricSparkline points={history} unit={unit} className="mt-3" /> : null}
    </div>
  );
}
