export function TrendArrow({
  current,
  previous,
}: {
  current: number | null;
  previous: number | null;
}) {
  if (current == null || previous == null) {
    return <span className="text-muted">—</span>;
  }
  const delta = current - previous;
  if (Math.abs(delta) < 1e-6) {
    return <span className="text-muted">Stable</span>;
  }
  if (delta > 0) {
    return <span className="text-gold">Increasing ↑</span>;
  }
  return <span className="text-cyan">Decreasing ↓</span>;
}
