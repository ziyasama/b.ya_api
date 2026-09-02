import type { HistoryPoint } from "@/lib/history/metrics";

const VIEW_W = 100;
const VIEW_H = 44;
const PAD_LEFT = 0;
const PAD_RIGHT = 2;
const PAD_TOP = 1;
const PAD_BOTTOM = 1;

function formatAxisValue(value: number, unit: string): string {
  if (unit === "") return String(Math.round(value));
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatAxisTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function yScale(min: number, max: number): { yMin: number; yMax: number; ticks: number[] } {
  const span = max - min;
  const pad = span === 0 ? Math.max(Math.abs(min) * 0.1, 0.5) : span * 0.04;
  const yMin = min - pad;
  const yMax = max + pad;

  if (Math.abs(yMax - yMin) < 1e-9) {
    return { yMin, yMax, ticks: [yMin] };
  }

  const mid = (yMin + yMax) / 2;
  return { yMin, yMax, ticks: [yMax, mid, yMin] };
}

function linePaths(
  points: Array<{ x: number; y: number } | null>,
): string[] {
  const paths: string[] = [];
  let open: { x: number; y: number }[] = [];

  for (const point of points) {
    if (!point) {
      if (open.length >= 2) {
        paths.push(
          open
            .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            .join(" "),
        );
      }
      open = [];
      continue;
    }
    open.push(point);
  }

  if (open.length >= 2) {
    paths.push(
      open
        .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" "),
    );
  }

  return paths;
}

export function MetricSparkline({
  points,
  unit,
  className = "",
}: {
  points: HistoryPoint[];
  unit: string;
  className?: string;
}) {
  const plotted = points.filter((point): point is HistoryPoint & { v: number } => point.v != null);
  if (plotted.length < 2) return null;

  const values = plotted.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const { yMin, yMax, ticks } = yScale(min, max);
  const yRange = yMax - yMin || 1;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const x0 = points.findIndex((point) => point.v != null);
  const x1 = points.findLastIndex((point) => point.v != null);
  const xSpan = Math.max(x1 - x0, 1);

  const toX = (index: number) => PAD_LEFT + ((index - x0) / xSpan) * plotW;
  const toY = (value: number) => PAD_TOP + (1 - (value - yMin) / yRange) * plotH;
  const axisX = PAD_LEFT;

  const scaled = points.map((point, index) => {
    if (point.v == null) return null;
    return { x: toX(index), y: toY(point.v) };
  });

  const paths = linePaths(scaled);
  if (!paths.length) return null;

  const lastPoint = scaled[x1];

  const tickLabels = ticks.map((tick) => formatAxisValue(tick, unit));
  const widestLabel = tickLabels.reduce((widest, label) =>
    label.length > widest.length ? label : widest,
  );

  return (
    <div className={className}>
      <div className="rounded-lg border border-border bg-background px-1.5 py-1">
        <div className="flex items-stretch gap-1">
          <div className="relative h-10 shrink-0">
            <span
              aria-hidden
              className="invisible block font-mono text-[9px] leading-none tabular-nums"
            >
              {widestLabel}
            </span>
            {ticks.map((tick, index) => {
              const top = (toY(tick) / VIEW_H) * 100;
              const isFirst = index === 0;
              const isLast = index === ticks.length - 1;
              return (
                <span
                  key={tick}
                  className="absolute right-0 font-mono text-[9px] leading-none tabular-nums text-muted"
                  style={{
                    top: `${top}%`,
                    transform: isFirst ? "translateY(0)" : isLast ? "translateY(-100%)" : "translateY(-50%)",
                  }}
                >
                  {tickLabels[index]}
                </span>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative">
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                className="block h-10 w-full overflow-visible"
                role="img"
                aria-label={`Past hour from ${formatAxisTime(plotted[0].t)} to ${formatAxisTime(plotted[plotted.length - 1].t)}, ${formatAxisValue(min, unit)} to ${formatAxisValue(max, unit)} ${unit}`.trim()}
              >
                <g className="text-border">
                  {ticks.map((tick) => {
                    const y = toY(tick);
                    return (
                      <line
                        key={tick}
                        x1={axisX}
                        y1={y}
                        x2={VIEW_W - PAD_RIGHT}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="0.35"
                        opacity="0.35"
                      />
                    );
                  })}
                </g>

                {paths.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fill="none"
                    className="text-cyan"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {lastPoint ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    left: `${(lastPoint.x / VIEW_W) * 100}%`,
                    top: `${(lastPoint.y / VIEW_H) * 100}%`,
                  }}
                >
                  <span className="absolute -translate-x-1/2 -translate-y-1/2">
                    <span className="block size-1.5 animate-spark-live rounded-full bg-cyan/55" />
                  </span>
                  <span className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan shadow-[0_0_6px_var(--color-cyan)]" />
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex justify-between font-mono text-[9px] leading-none text-muted">
              <span>{formatAxisTime(plotted[0].t)}</span>
              <span>{formatAxisTime(plotted[plotted.length - 1].t)}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Past 1 h</p>
    </div>
  );
}
