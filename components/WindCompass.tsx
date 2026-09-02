export function WindCompass({
  direction,
  className = "",
}: {
  direction: number | null;
  className?: string;
}) {
  const rotation = direction ?? 0;
  const active = direction != null;

  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden={!active}
      aria-label={active ? `Wind from ${Math.round(direction)} degrees` : undefined}
      className={`h-12 w-12 shrink-0 ${className}`}
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {(["N", "E", "S", "W"] as const).map((label, index) => {
        const angle = index * 90;
        const rad = ((angle - 90) * Math.PI) / 180;
        const x = 24 + Math.cos(rad) * 16;
        const y = 24 + Math.sin(rad) * 16;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--muted)"
            fontSize="7"
            fontFamily="var(--font-geist-mono), monospace"
          >
            {label}
          </text>
        );
      })}
      {active ? (
        <g transform={`rotate(${rotation} 24 24)`}>
          <polygon points="24,7 21.5,24 26.5,24" fill="#ef4444" />
          <line
            x1="24"
            y1="24"
            x2="24"
            y2="38"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : null}
      <circle cx="24" cy="24" r="2.5" fill={active ? "#ef4444" : "var(--muted)"} />
    </svg>
  );
}
