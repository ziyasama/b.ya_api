import Link from "next/link";
import type { ComponentProps } from "react";

function pillClasses(compact?: boolean) {
  const size = compact ? "min-h-6 min-w-10 px-2 py-1" : "min-h-7 px-3 py-1.5";
  return [
    "inline-flex shrink-0 select-none items-center justify-center rounded-md border font-mono text-[11px] uppercase leading-none tracking-wider",
    size,
  ].join(" ");
}

export function PillButton({
  className = "",
  compact = false,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & { compact?: boolean }) {
  return (
    <button type={type} className={`${pillClasses(compact)} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PillLink({
  className = "",
  compact = false,
  children,
  ...props
}: ComponentProps<typeof Link> & { compact?: boolean }) {
  return (
    <Link className={`${pillClasses(compact)} ${className}`} {...props}>
      {children}
    </Link>
  );
}
