export function MapLegend() {
  return (
    <div className="rounded-xl border border-border bg-panel p-4 text-xs">
      <p className="mb-3 text-[11px] uppercase tracking-widest text-muted">Legend</p>
      <ul className="space-y-2.5">
        <li className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 h-3 w-5 shrink-0 rounded-sm border-2 border-cyan bg-cyan/15"
          />
          <span>
            <span className="text-foreground">Solid cyan rectangle</span> — AIS vessel
            WebSocket filter (AISStream.io), strait box (tight).
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 h-3 w-5 shrink-0 rounded-sm border-2 border-dashed border-cyan bg-cyan/5"
          />
          <span>
            <span className="text-foreground">Dashed cyan rectangle</span> — same AIS
            filter, wider box (Marmara → strait → Black Sea approaches), added because
            the tight box was silent.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-panel bg-gold"
          />
          <span>
            <span className="text-foreground">Gold point</span> — weather/marine REST
            poll (Open-Meteo wind, wave, SST). CMEMS currents/salinity/density will use
            this same point once wired.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-cyan bg-foreground"
          />
          <span>
            <span className="text-foreground">White/cyan dot</span> — a live vessel
            position from the latest logged AIS snapshot, if any.
          </span>
        </li>
      </ul>
      <p className="mt-3 border-t border-border pt-3 text-muted">
        This map is documentation for the team, not the OSC/MIDI output.
      </p>
    </div>
  );
}
