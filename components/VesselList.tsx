"use client";

import { useEffect, useState } from "react";
import type { VesselRecord } from "@/lib/supabase/database.types";

const PAGE_SIZE = 10;

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
      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted hover:border-cyan hover:text-cyan disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function VesselList({ vessels }: { vessels: VesselRecord[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(vessels.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = vessels.slice(
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
      <ul className="divide-y divide-border">
        {visible.map((vessel) => (
          <li
            key={vessel.mmsi}
            className="flex items-baseline justify-between gap-3 px-4 py-2 font-mono text-xs"
          >
            <span className="text-cyan">{vessel.mmsi}</span>
            <span className="truncate text-muted">
              {vessel.shipName ?? "unknown"}
            </span>
            <span>
              {vessel.transit === "northbound"
                ? "N"
                : vessel.transit === "southbound"
                  ? "S"
                  : "—"}{" "}
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
