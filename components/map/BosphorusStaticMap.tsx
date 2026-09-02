import type { BosphorusGeo } from "@/lib/map/geo";
import { mapDisplayBounds, isWithinBounds } from "@/lib/map/bounds";
import { bosphorusCoastline, bosphorusLand } from "@/lib/map/cartography";
import {
  coastlinePathsFromCollection,
  landPathsFromCollection,
  REGION_LABELS,
} from "@/lib/map/render";
import { projectLonLat, boundingBoxPath } from "@/lib/map/projection";
import { METAR_AIRPORTS, TIDE_GAUGES } from "@/lib/map/stations";

const VIEW_W = 720;
const VIEW_H = 420;
/** Empty Black Sea water above the scan area — crop, don't squash. */
const CROP_TOP = 25;
const VISIBLE_H = VIEW_H - CROP_TOP;
const CYAN = "#22d3ee";
const GOLD = "#eab308";
const MUTED = "#8ba3ad";
const PANEL = "#0e1620";
const LAND = "#0a1218";
const WATER = "#0c1a28";
const BORDER = "#1c2a36";
const COAST = "#2a4558";

function Marker({
  x,
  y,
  fill,
  stroke = PANEL,
  r = 5,
  label,
}: {
  x: number;
  y: number;
  fill: string;
  stroke?: string;
  r?: number;
  label: string;
}) {
  return (
    <g>
      <title>{label}</title>
      <circle cx={x} cy={y} r={r + 6} fill={fill} opacity={0.2} />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
    </g>
  );
}

/** Geographic north-up rose for the static scan map (not wind direction). */
function MapCompass({ className }: { className?: string }) {
  const cx = 34;
  const cy = 34;

  return (
    <svg
      viewBox="0 0 68 68"
      role="img"
      aria-label="Map orientation: north is up, south is down, west is left, east is right"
      className={className}
    >
      <title>North is up</title>
      <circle
        cx={cx}
        cy={cy}
        r={32}
        fill={PANEL}
        fillOpacity={0.9}
        stroke={BORDER}
        strokeWidth={1.25}
      />
      {([45, 135, 225, 315] as const).map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={cx + Math.cos(rad) * 21}
            y1={cy + Math.sin(rad) * 21}
            x2={cx + Math.cos(rad) * 26}
            y2={cy + Math.sin(rad) * 26}
            stroke={MUTED}
            strokeWidth={0.75}
            strokeLinecap="round"
            opacity={0.55}
          />
        );
      })}
      <polygon points="34,18 30.75,34 37.25,34" fill={GOLD} />
      <polygon points="34,50 30.75,34 37.25,34" fill={MUTED} opacity={0.4} />
      <circle cx={cx} cy={cy} r={2.25} fill={GOLD} />
      <text
        x={cx}
        y={11}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GOLD}
        fontSize={9}
        fontFamily="monospace"
        fontWeight={700}
      >
        N
      </text>
      <text
        x={cx}
        y={57}
        textAnchor="middle"
        dominantBaseline="central"
        fill={MUTED}
        fontSize={8}
        fontFamily="monospace"
      >
        S
      </text>
      <text
        x={11}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={MUTED}
        fontSize={8}
        fontFamily="monospace"
      >
        W
      </text>
      <text
        x={57}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={MUTED}
        fontSize={8}
        fontFamily="monospace"
      >
        E
      </text>
    </svg>
  );
}

export function BosphorusStaticMap({
  geo,
  className,
}: {
  geo: BosphorusGeo;
  compact?: boolean;
  className?: string;
}) {
  const bounds = mapDisplayBounds(geo);
  const project = (lon: number, lat: number) =>
    projectLonLat(lon, lat, bounds, VIEW_W, VIEW_H);
  const wind = project(geo.point.lon, geo.point.lat);
  const wave = project(geo.wavePoint.lon, geo.wavePoint.lat);
  const landPaths = landPathsFromCollection(bosphorusLand, bounds, VIEW_W, VIEW_H);
  const coastPaths = coastlinePathsFromCollection(
    bosphorusCoastline,
    bounds,
    VIEW_W,
    VIEW_H,
  );
  const aisApproachesPath = boundingBoxPath(geo.approaches, bounds, VIEW_W, VIEW_H);
  const aisStraitPath = boundingBoxPath(geo.strait, bounds, VIEW_W, VIEW_H);

  return (
    <div className={className ?? "flex flex-col gap-2"}>
      <div className="relative overflow-hidden rounded-xl border border-border">
      <svg
        viewBox={`0 ${CROP_TOP} ${VIEW_W} ${VISIBLE_H}`}
        role="img"
        aria-label="Map of the Bosphorus showing where each data source is sampled. North is up."
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect y={CROP_TOP} width={VIEW_W} height={VISIBLE_H} fill={WATER} />

        <path
          d={aisApproachesPath}
          fill={CYAN}
          fillOpacity={0.04}
          pointerEvents="none"
        >
          <title>AIS approaches scan area (Marmara → strait → Black Sea)</title>
        </path>

        {landPaths.map((d, index) => (
          <path
            key={`land-${index}`}
            d={d}
            fill={LAND}
            fillRule="evenodd"
            stroke={BORDER}
            strokeWidth={0.75}
            strokeLinejoin="round"
          />
        ))}

        {coastPaths.map((d, index) => (
          <path
            key={`coast-${index}`}
            d={d}
            fill="none"
            stroke={COAST}
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <path
          d={aisStraitPath}
          fill={CYAN}
          fillOpacity={0.09}
          stroke={CYAN}
          strokeOpacity={0.28}
          strokeWidth={1}
          strokeDasharray="5 4"
          pointerEvents="none"
        >
          <title>AIS strait scan area (tight box)</title>
        </path>

        {REGION_LABELS.map(({ lon, lat, text, anchor }) => {
          const { x, y } = project(lon, lat);
          return (
            <text
              key={text}
              x={x}
              y={y}
              fill={MUTED}
              fontSize={11}
              fontFamily="monospace"
              opacity={0.85}
              textAnchor={anchor ?? "start"}
            >
              {text}
            </text>
          );
        })}

        {TIDE_GAUGES.filter((station) =>
          isWithinBounds(station.lon, station.lat, bounds),
        ).map((station) => {
          const { x, y } = project(station.lon, station.lat);
          const isBackup = station.id === "igne" || station.id === "maer";
          return (
            <Marker
              key={station.id}
              x={x}
              y={y}
              r={isBackup ? 4 : 5}
              fill="#e8f4f8"
              stroke={isBackup ? MUTED : CYAN}
              label={station.label}
            />
          );
        })}

        {METAR_AIRPORTS.map((airport) => {
          const { x, y } = project(airport.lon, airport.lat);
          return (
            <Marker
              key={airport.id}
              x={x}
              y={y}
              fill={CYAN}
              label={airport.label}
            />
          );
        })}

        <Marker
          x={wave.x}
          y={wave.y}
          r={6}
          fill={GOLD}
          label={`Open-Meteo marine · ${geo.wavePoint.lat.toFixed(2)}°N ${geo.wavePoint.lon.toFixed(2)}°E`}
        />
        <Marker
          x={wind.x}
          y={wind.y}
          r={5}
          fill={GOLD}
          stroke={BORDER}
          label={`Open-Meteo wind fallback · ${geo.point.lat.toFixed(2)}°N ${geo.point.lon.toFixed(2)}°E`}
        />

        <text x={VIEW_W - 12} y={VIEW_H - 8} fill={MUTED} fontSize={9} textAnchor="end">
          © Natural Earth
        </text>
      </svg>
      <MapCompass className="pointer-events-none absolute bottom-2.5 left-2.5 h-14 w-14 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:h-16 sm:w-16" />
      </div>
      <div className="space-y-2 px-1 text-xs leading-relaxed text-muted">
        <p className="font-mono text-[11px] uppercase tracking-wider text-cyan">
          Map key
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-0.5 h-3 w-5 shrink-0 rounded-sm border border-dashed border-cyan/30 bg-cyan/[0.08]"
            />
            <span>
              <span className="text-foreground">Soft cyan wash</span> — AIS maritime
              traffic scan area: a tight strait box inside the wider Marmara → strait →
              Black Sea approaches box. This is where live vessel counts are calculated
              from.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-panel bg-cyan"
            />
            <span>
              <span className="text-foreground">Cyan dots</span> — METAR airport
              anemometers (LTFM, LTBA, LTFJ) used for measured wind.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-cyan bg-foreground"
            />
            <span>
              <span className="text-foreground">White dots</span> — IOC tide gauges
              on the map (Şile · Black Sea, Yalova · Marmara). İğneada and Marmara
              Ereğlisi are farther-away backups and are not drawn here.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-panel bg-gold"
            />
            <span>
              <span className="text-foreground">Gold dots</span> — Open-Meteo sample
              points for wind fallback and marine readings (wave, swell, water temp).
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
