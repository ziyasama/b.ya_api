"use client";

import { useEffect, useRef, useState } from "react";

const PLAY_SRC = "/api/radio";

export function RadioListen({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [faderOpen, setFaderOpen] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!faderOpen) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFaderOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [faderOpen]);

  async function tryPlay(src: string) {
    const el = audioRef.current;
    if (!el) throw new Error("no audio");
    el.muted = false;
    el.volume = volume;
    el.src = src;
    await el.play();
  }

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      setPlaying(false);
      setFaderOpen(false);
      return;
    }
    try {
      setError(false);
      try {
        await tryPlay(`${PLAY_SRC}?t=${Date.now()}`);
      } catch {
        await tryPlay(url);
      }
      setPlaying(true);
      setFaderOpen(true);
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void toggle()}
          aria-pressed={playing}
          aria-label={playing ? "Stop Bosphorus radio" : "Listen to Bosphorus radio"}
          title={
            error
              ? "Stream unreachable — is radio/docker-compose.yml up?"
              : "Local Icecast"
          }
          className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider hover:opacity-80 ${
            playing
              ? "border-gold text-gold"
              : error
                ? "border-muted text-muted"
                : "border-cyan text-cyan"
          }`}
        >
          {playing ? "● Radio" : error ? "Radio · off" : "▶ Radio"}
        </button>
        {playing ? (
          <button
            type="button"
            aria-expanded={faderOpen}
            aria-label="Volume"
            onClick={() => setFaderOpen((open) => !open)}
            className="rounded-full border border-border px-2 py-1 font-mono text-[11px] text-muted hover:opacity-80"
          >
            {faderOpen ? "▴" : "▾"}
          </button>
        ) : null}
      </div>
      {faderOpen ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-xl border border-border bg-panel px-3 py-2 shadow-lg">
          <label className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
            Vol
            <span>{Math.round(volume * 100)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="mt-1 w-full accent-gold"
            aria-label="Radio volume"
          />
        </div>
      ) : null}
      <audio
        ref={audioRef}
        preload="none"
        playsInline
        onError={() => {
          setError(true);
          setPlaying(false);
          setFaderOpen(false);
        }}
      />
    </div>
  );
}
