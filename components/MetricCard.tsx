import { TrendArrow } from "@/components/TrendArrow";

export function MetricCard({
  label,
  value,
  previous,
  unit,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-xl">
        {value == null ? "—" : Number.isInteger(value) ? value : value.toFixed(2)}
        <span className="ml-1 text-sm text-muted">{unit}</span>
      </p>
      <p className="mt-2 text-xs">
        <TrendArrow current={value} previous={previous} />
      </p>
    </div>
  );
}
