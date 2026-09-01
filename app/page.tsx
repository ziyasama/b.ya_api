import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.35em] text-cyan uppercase">
        Bosphorus
      </p>
      <h1 className="mt-4 max-w-md text-center text-3xl font-semibold tracking-tight">
        Data Aggregation Hub
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm text-muted">
        Live wind, wave, current, and vessel state — plumbing for OSC and MIDI.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-full border border-cyan/40 bg-panel px-6 py-3 text-sm font-medium text-cyan transition hover:border-gold hover:text-gold"
      >
        Open dashboard
      </Link>
    </div>
  );
}
