const NOTES = [
  {
    title: "AIS silent stream",
    body: "Diagnose zero-frame subscription after confirmation; keep the bbox above honest with lib/env.ts; Vessels card fills once frames arrive.",
  },
  {
    title: "CMEMS / EMODnet",
    body: "Account at data.marine.copernicus.eu (MEDSEA_ANALYSISFORECAST_PHY_006_013). Node worker doesn't use CMEMS_USERNAME/PASSWORD yet — currents/salinity/density stay unavailable until Copernicus Marine Toolbox or CMEMS_ERDDAP_URL is wired. No faked values.",
  },
  {
    title: "OSC / MIDI",
    body: "lib/osc-midi + npm run broadcast, installation Mac only (not Railway). OSC_MIDI_DRY_RUN=true until the audio patch is ready. Mapping table lib/osc-midi/mapping.ts needs artist/patch review.",
  },
  {
    title: "Railway",
    body: "Two services from this repo: web (npm start) and worker (npm run worker). Copy .env.local into Railway Variables — never OSC/MIDI vars.",
  },
  {
    title: "Secrets",
    body: "Never commit .env.local. Next.js only loads .env.local.",
  },
];

export function ScanStatusNotes({ compact = false }: { compact?: boolean }) {
  const items = compact ? NOTES.slice(0, 2) : NOTES;
  return (
    <div className="rounded-xl border border-border bg-panel p-4 text-xs">
      <p className="mb-3 text-[11px] uppercase tracking-widest text-muted">
        Leftover work — status
      </p>
      <ul className="space-y-3">
        {items.map((note) => (
          <li key={note.title}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-gold">
              {note.title}
            </p>
            <p className="mt-0.5 text-muted">{note.body}</p>
          </li>
        ))}
      </ul>
      {compact ? (
        <p className="mt-3 border-t border-border pt-3 text-muted">
          Full list on{" "}
          <a href="/map" className="text-cyan underline-offset-2 hover:underline">
            /map
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
