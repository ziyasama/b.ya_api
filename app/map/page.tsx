import Link from "next/link";
import { BosphorusScanMap } from "@/components/map/BosphorusScanMap";
import { getBosphorusGeo } from "@/lib/map/geo";

export const dynamic = "force-dynamic";

export default function MapPage() {
  const geo = getBosphorusGeo();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">
            Bosphorus
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scan area map</h1>
          <p className="mt-1 text-xs text-muted">
            Where each source is sampled — fixed reference, not live traffic.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
        >
          ← Dashboard
        </Link>
      </header>

      <BosphorusScanMap geo={geo} />
    </div>
  );
}
