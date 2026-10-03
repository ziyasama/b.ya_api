"use client";

import { useEffect, useState } from "react";
import type { VesselRecord } from "@/lib/supabase/database.types";
import { inStrait, straitFirst } from "@/lib/vessels/inside";

const PAGE_SIZE = 10;

const ROW =
  "grid grid-cols-[5.5rem_minmax(0,1fr)_2.75rem_7.75rem] items-baseline gap-x-3";

function wayMark(transit: VesselRecord["transit"]): string {
  if (transit === "northbound") return "N";
  if (transit === "southbound") return "S";
  return "STILL";
}

const COLUMNS: { label: string; hint: string; tip: "left" | "right" }[] = [
  {
    label: "MMSI",
    hint: "Maritime Mobile Service Identity. The ship's radio identity number.",
    tip: "left",
  },
  {
    label: "Name",
    hint: "The name it broadcasts. A green dot means the ship is inside the strait.",
    tip: "left",
  },
  {
    label: "Way",
    hint: "The last move. N is north, toward the Black Sea. S is south, toward the Marmara. STILL means sitting in place, or only one position so far.",
    tip: "right",
  },
  {
    label: "Position",
    hint: "The latest latitude and longitude.",
    tip: "right",
  },
];

function ColumnTitle({
  label,
  hint,
  tip,
}: {
  label: string;
  hint: string;
  tip: "left" | "right";
}) {
  const tipId = `vessel-col-${label.toLowerCase()}`;
  return (
    <span className={`group relative ${label === "Position" ? "justify-self-end" : ""}`}>
      <span
        tabIndex={0}
        aria-describedby={tipId}
        className="cursor-help border-b border-dotted border-current/40 outline-none hover:text-cyan focus-visible:text-cyan"
      >
        {label}
      </span>
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-10 mt-1.5 hidden w-64 rounded-md border border-border bg-background px-2.5 py-1.5 text-left font-sans text-xs font-medium normal-case leading-relaxed tracking-normal text-foreground group-hover:block group-focus-within:block ${
          tip === "right" ? "right-0" : "left-0"
        }`}
      >
        {hint}
      </span>
    </span>
  );
}

function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M8 2 L4 6 L8 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M4 2 L8 6 L4 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LiveDot({ label }: { label: string }) {
  return (
    <span
      className="relative inline-flex size-1.5 shrink-0"
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden className="absolute inset-0 animate-spark-live rounded-full bg-green/70" />
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-green shadow-[0_0_6px_var(--color-green)]"
      />
    </span>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted hover:border-cyan hover:text-cyan disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function VesselList({ vessels }: { vessels: VesselRecord[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(vessels.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const ordered = straitFirst(vessels);
  const visible = ordered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  if (vessels.length === 0) {
    return <p className="text-sm text-muted">No vessels in the bounding box.</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-panel">
      <header className="relative z-10 border-b border-border px-4 py-2.5">
        <div
          className={`${ROW} font-mono text-xs uppercase tracking-wider text-muted`}
        >
          {COLUMNS.map((column) => (
            <ColumnTitle key={column.label} {...column} />
          ))}
        </div>
      </header>
      <ul className="divide-y divide-border">
        {visible.map((vessel) => (
          <li
            key={vessel.mmsi}
            className={`${ROW} px-4 py-2 font-mono text-xs`}
          >
            <span className="text-cyan">{vessel.mmsi}</span>
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="min-w-0 truncate text-muted">
                {vessel.shipName ?? "unknown"}
              </span>
              {inStrait(vessel.lat, vessel.lon) ? (
                <span className="self-center">
                  <LiveDot label="In the strait" />
                </span>
              ) : null}
            </span>
            <span className={vessel.transit ? undefined : "text-muted/70"}>
              {wayMark(vessel.transit)}
            </span>
            <span className="text-right">
              {vessel.lat.toFixed(3)}, {vessel.lon.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <nav
          aria-label="Vessel list pages"
          className="flex items-center justify-end gap-2 border-t border-border px-3 py-2"
        >
          <PageButton
            label="Previous page"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft />
          </PageButton>
          <span className="min-w-12 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
            {safePage + 1} / {totalPages}
          </span>
          <PageButton
            label="Next page"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight />
          </PageButton>
        </nav>
      ) : null}
    </div>
  );
}
