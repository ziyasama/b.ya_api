import type { HistoryPoint } from "@/lib/history/metrics";

const VIEW_W = 100;
const VIEW_H = 44;
const PAD_LEFT = 0;
const PAD_RIGHT = 2;
const PAD_TOP = 3;
const PAD_BOTTOM = 3;

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
  const pad = span === 0 ? Math.max(Math.abs(min) * 0.1, 0.5) : span * 0.08;
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

  const t0 = Date.parse(plotted[0].t);
  const t1 = Date.parse(plotted[plotted.length - 1].t);
  const tRange = t1 - t0 || 1;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  const toX = (time: number) => PAD_LEFT + ((time - t0) / tRange) * plotW;
  const toY = (value: number) => PAD_TOP + (1 - (value - yMin) / yRange) * plotH;
  const axisX = PAD_LEFT;

  const scaled = points.map((point) => {
    if (point.v == null) return null;
    return { x: toX(Date.parse(point.t)), y: toY(point.v) };
  });

  const paths = linePaths(scaled);
  if (!paths.length) return null;

  return (
    <div className={className}>
      <div className="flex items-stretch gap-1.5">
        <div className="relative w-10 shrink-0" style={{ height: "2.5rem" }}>
          {ticks.map((tick) => {
            const top = (1 - (tick - yMin) / yRange) * 100;
            return (
              <span
                key={tick}
                className="absolute right-0 translate-y-[-50%] font-mono text-[9px] leading-none text-muted"
                style={{ top: `${top}%` }}
              >
                {formatAxisValue(tick, unit)}
              </span>
            );
          })}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-10 w-full"
            role="img"
            aria-label={`Past hour from ${formatAxisTime(plotted[0].t)} to ${formatAxisTime(plotted[plotted.length - 1].t)}, ${formatAxisValue(min, unit)} to ${formatAxisValue(max, unit)} ${unit}`.trim()}
          >
            <g className="text-border">
              <line
                x1={axisX}
                y1={PAD_TOP}
                x2={axisX}
                y2={PAD_TOP + plotH}
                stroke="currentColor"
                strokeWidth="0.6"
              />
              <line
                x1={axisX}
                y1={PAD_TOP + plotH}
                x2={VIEW_W - PAD_RIGHT}
                y2={PAD_TOP + plotH}
                stroke="currentColor"
                strokeWidth="0.6"
              />
              {ticks.map((tick) => {
                const y = toY(tick);
                return (
                  <g key={tick}>
                    <line x1={axisX - 2.5} y1={y} x2={axisX} y2={y} stroke="currentColor" strokeWidth="0.6" />
                    <line
                      x1={axisX}
                      y1={y}
                      x2={VIEW_W - PAD_RIGHT}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="0.35"
                      opacity="0.35"
                    />
                  </g>
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

          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted">
            <span>{formatAxisTime(plotted[0].t)}</span>
            <span>{formatAxisTime(plotted[plotted.length - 1].t)}</span>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Past 1 h</p>
    </div>
  );
}
