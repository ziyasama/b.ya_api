export function Gauge({
  label,
  value,
  unit,
  normalized,
}: {
  label: string;
  value: number | null;
  unit: string;
  normalized: number;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, normalized)) * 100);
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl text-cyan">
        {value == null ? "—" : value.toFixed(2)}
        <span className="ml-1 text-sm text-muted">{unit}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan to-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
