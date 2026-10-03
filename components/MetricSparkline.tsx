import { HISTORY_WINDOW_MS, type HistoryPoint } from "@/lib/history/metrics";

const historyWindowHours = HISTORY_WINDOW_MS / 3_600_000;
const historyWindowLabel = `Past ${historyWindowHours} h`;
const MAX_SPARKLINE_POINTS = 120;

function downsampleForDisplay(points: HistoryPoint[]): HistoryPoint[] {
  if (points.length <= MAX_SPARKLINE_POINTS) return points;

  const tStart = Date.parse(points[0].t);
  const tEnd = Date.parse(points[points.length - 1].t);
  const span = Math.max(tEnd - tStart, 1);
  const bucketWidth = span / MAX_SPARKLINE_POINTS;
  const buckets: HistoryPoint[][] = Array.from({ length: MAX_SPARKLINE_POINTS }, () => []);

  for (const point of points) {
    let idx = Math.floor((Date.parse(point.t) - tStart) / bucketWidth);
    if (idx >= MAX_SPARKLINE_POINTS) idx = MAX_SPARKLINE_POINTS - 1;
    buckets[idx].push(point);
  }

  const sampled: HistoryPoint[] = [];
  for (const bucket of buckets) {
    if (!bucket.length) continue;
    const withValue = bucket.filter((point) => point.v != null);
    sampled.push(withValue.length ? withValue[withValue.length - 1]! : bucket[bucket.length - 1]!);
  }
  return sampled;
}

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
  const series = downsampleForDisplay(points);
  const plotted = series.filter((point): point is HistoryPoint & { v: number } => point.v != null);
  if (plotted.length < 2) return null;

  const values = plotted.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flatCount = unit === "" && min === max;
  const { yMin, yMax, ticks } = flatCount
    ? { yMin: min, yMax: min, ticks: [min] }
    : yScale(min, max);
  const yRange = yMax - yMin || 1;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const t0 = Date.parse(series[0].t);
  const t1 = Date.parse(series[series.length - 1].t);
  const tSpan = Math.max(t1 - t0, 1);

  const toX = (iso: string) => PAD_LEFT + ((Date.parse(iso) - t0) / tSpan) * plotW;
  const toY = (value: number) => PAD_TOP + (1 - (value - yMin) / yRange) * plotH;
  const axisX = PAD_LEFT;

  const scaled = series.map((point) => {
    if (point.v == null) return null;
    return { x: toX(point.t), y: toY(point.v) };
  });

  const paths = linePaths(scaled);
  if (!paths.length) return null;

  const lastIndex = scaled.findLastIndex((point) => point != null);
  const lastPoint = lastIndex >= 0 ? scaled[lastIndex] : null;

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
                  key={`${tick}-${index}`}
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
                aria-label={`${historyWindowLabel} from ${formatAxisTime(plotted[0].t)} to ${formatAxisTime(plotted[plotted.length - 1].t)}, ${formatAxisValue(min, unit)} to ${formatAxisValue(max, unit)} ${unit}`.trim()}
              >
                <g className="text-border">
                  {ticks.map((tick, index) => {
                    const y = toY(tick);
                    return (
                      <line
                        key={`${tick}-${index}`}
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

                {paths.map((d, index) => (
                  <path
                    key={index}
                    d={d}
                    fill="none"
                    stroke="var(--color-cyan)"
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
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{historyWindowLabel}</p>
    </div>
  );
}
