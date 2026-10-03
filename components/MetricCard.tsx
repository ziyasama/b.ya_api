import { MetricSparkline } from "@/components/MetricSparkline";
import { TrendArrow } from "@/components/TrendArrow";
import { WindCompass } from "@/components/WindCompass";
import type { HistoryPoint } from "@/lib/history/metrics";

export function MetricCard({
  label,
  value,
  previous,
  unit,
  history,
  compassDirection,
  direction,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  unit: string;
  history?: HistoryPoint[];
  compassDirection?: number | null;
  /** Flow sense shown in parentheses after the reading, e.g. "south". */
  direction?: string | null;
}) {
  return (
    <div className="relative h-full rounded-xl border border-border bg-panel p-4">
      {compassDirection !== undefined ? (
        <WindCompass direction={compassDirection} className="absolute right-3 top-3" />
      ) : null}
      <p
        className={`text-xs uppercase tracking-widest text-muted${compassDirection !== undefined ? " pr-14" : ""}`}
      >
        {label}
      </p>
      <p className="mt-2 font-mono text-xl">
        {value == null ? "—" : Number.isInteger(value) ? value : value.toFixed(2)}
        <span className="ml-1 text-sm text-muted">{unit}</span>
        {direction ? (
          <span className="ml-1.5 text-sm text-muted">({direction})</span>
        ) : null}
      </p>
      <p className="mt-2 text-xs">
        <TrendArrow current={value} previous={previous} />
      </p>
      {history ? <MetricSparkline points={history} unit={unit} className="mt-3" /> : null}
    </div>
  );
}
