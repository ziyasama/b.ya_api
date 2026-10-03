"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  formatOscReading,
  isOscPort,
  levelMessages,
  levelReading,
  OSC_CHANNELS,
  OSC_HOSTS,
  OSC_PORT_MAX,
  OSC_PORT_MIN,
  oscChannel,
  type OscChannel,
  type OscOutbound,
} from "@/lib/osc-panel/catalog";
import {
  enabledGateCc,
  enabledMidiLevels,
  formatMidiRange,
  MIDI_14BIT_MAX,
  MIDI_CHANNEL,
  MIDI_GATE_BLIP_MS,
  midiWord,
  scaleToMidi14,
  DAY_PART_CC,
  DAY_PARTS,
  dayPartAt,
  snapshotMidiLevels,
  TIME_CC,
  timeOfDayCc,
  withLevelMidiOn,
} from "@/lib/osc-panel/midi";
import {
  blipCc14,
  connectMidi,
  getMidiStatus,
  getServerMidiStatus,
  releaseMidiBlips,
  sendCc14,
  sendCc7,
  sendCc14Sequence,
  subscribeMidi,
  type MidiStatus,
} from "@/lib/osc-panel/webmidi";
import {
  getOscSettings,
  getServerOscSettings,
  getServerTimeMidi,
  getTimeMidi,
  setTimeMidi,
  subscribeOscSettings,
  subscribeTimeMidi,
  updateOscSettings,
} from "@/lib/osc-panel/settings";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { BosphorusStateRow, VesselEventRow } from "@/lib/supabase/database.types";
import { rowToState } from "@/lib/standardize/row";
import type { BosphorusState } from "@/lib/standardize/types";

function midiUnavailable(status: MidiStatus): string {
  if (status.state === "unsupported") return "Web MIDI needs Chrome.";
  if (status.state === "denied") return "Chrome blocked MIDI for this site.";
  if (status.state === "no-output") return "IAC Driver is offline.";
  return "MIDI is not ready.";
}

async function pullCompiledState(): Promise<BosphorusState | null> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("bosphorus_state_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToState(data) : null;
}

async function postOsc(messages: OscOutbound[]): Promise<void> {
  const response = await fetch("/api/osc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = body && typeof body.error === "string" ? body.error : "OSC send failed";
    throw new Error(message);
  }
}

function MidiStatusLine({ status }: { status: MidiStatus }) {
  if (status.state === "ready") {
    return (
      <p className="mt-1 text-xs text-muted">
        MIDI {status.name} · channel 1 · map the CC, not the +32 fine byte
      </p>
    );
  }
  if (status.state === "idle") {
    return <p className="mt-1 text-xs text-muted">Opening MIDI…</p>;
  }
  if (status.state === "connecting") {
    return <p className="mt-1 text-xs text-muted">Allow MIDI for this site if Chrome asks.</p>;
  }
  if (status.state === "unsupported") {
    return <p className="mt-1 text-xs text-gold">Web MIDI needs Chrome.</p>;
  }
  const blocked = status.state === "denied";
  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <p
        className={`text-xs ${blocked ? "text-red" : "text-muted"}`}
        title={blocked ? status.message : undefined}
      >
        {blocked
          ? "Chrome blocked MIDI for this site."
          : status.names.length > 0
            ? `IAC Driver is offline. Chrome can already send to ${status.names.join(", ")}.`
            : "IAC Driver is offline. Chrome has no MIDI outputs yet."}
      </p>
      {blocked ? null : (
        <p className="max-w-xl text-xs text-muted">
          Audio MIDI Setup → Window → Show MIDI Studio → double-click IAC Driver → Device is
          online. Then in Live, turn Remote on for IAC Driver Bus 1 and MIDI-map the CC number
          on each row.
        </p>
      )}
      <button
        type="button"
        onClick={() => void connectMidi()}
        className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted hover:border-cyan hover:text-cyan"
      >
        Retry MIDI
      </button>
    </div>
  );
}

function OutputColumn({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">{title}</p>
        <dl className="flex flex-col gap-1.5">{children}</dl>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 px-1">{actions}</div>
    </div>
  );
}

function PanelTest({
  label,
  sent,
  onClick,
}: {
  label: string;
  sent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-full border border-gold px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-gold hover:opacity-80"
    >
      {sent ? "Sent" : "Test"}
    </button>
  );
}

function PanelSwitch({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-w-10 items-center justify-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
        on ? "border-green text-green" : "border-red text-red"
      }`}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

function OscPortInput({
  label,
  value,
  onChange,
  onBlur,
  onStep,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  onBlur: (raw: string) => void;
  onStep: (delta: 1 | -1) => void;
}) {
  const stepper =
    "flex flex-1 items-center justify-center bg-foreground font-mono text-[8px] leading-none text-background hover:bg-background/10";
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded border border-foreground">
      <input
        type="number"
        inputMode="numeric"
        min={OSC_PORT_MIN}
        max={OSC_PORT_MAX}
        spellCheck={false}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur(event.currentTarget.value)}
        className="w-11 border-0 bg-foreground px-1 py-0.5 text-right font-mono text-[11px] tabular-nums text-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex w-4 shrink-0 flex-col border-l border-background/20">
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onStep(1)} className={stepper}>
          ▲
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onStep(-1)}
          className={`${stepper} border-t border-background/20`}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-[11px] text-foreground">{value}</dd>
    </div>
  );
}

function clockMinute(minute: number): string {
  const wrapped = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function TimeMidiPanel({ onError }: { onError: (message: string | null) => void }) {
  const [now, setNow] = useState(() => new Date());
  const [sent, setSent] = useState(false);
  const midiOn = useSyncExternalStore(subscribeTimeMidi, getTimeMidi, getServerTimeMidi);
  const midiStatus = useSyncExternalStore(subscribeMidi, getMidiStatus, getServerMidiStatus);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const value = timeOfDayCc(now);
  const part = dayPartAt(now);
  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!midiOn || midiStatus.state !== "ready") return;
    sendCc7(TIME_CC, value);
    sendCc7(DAY_PART_CC, part.value);
  }, [midiOn, midiStatus, value, part.value]);

  async function testTime() {
    await connectMidi();
    const midi = getMidiStatus();
    if (midi.state !== "ready") {
      onError(midiUnavailable(midi));
      return;
    }
    const date = new Date();
    sendCc7(TIME_CC, timeOfDayCc(date));
    sendCc7(DAY_PART_CC, dayPartAt(date).value);
    onError(null);
    setSent(true);
    window.setTimeout(() => setSent(false), 400);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <h2 className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.25em] text-foreground/80">
          Time
        </h2>
        <div className="h-px flex-1 bg-foreground/25" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-foreground">
            Time of day
            <span className="ml-2 font-mono text-muted">{clock}</span>
            <span className="ml-2 font-mono text-muted">
              {part.label} · {part.value}
            </span>
          </p>
          <p className="text-[11px] text-muted">Local time on this machine, across one day.</p>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">MIDI</p>
            <dl className="flex flex-col gap-1.5">
              <Fact label="CC" value={TIME_CC} />
              <Fact label="Channel" value={MIDI_CHANNEL + 1} />
              <Fact label="Scale" value="0 midnight · 127 end of day" />
              <Fact label="Now" value={String(value)} />
            </dl>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">
              MIDI · CC {DAY_PART_CC}
            </p>
            <div className="grid grid-cols-[6.2rem_6.2rem_minmax(0,1fr)_2rem] gap-x-2 font-mono text-[10px] uppercase tracking-wider text-muted">
              <span>Part</span>
              <span>Hours</span>
              <span>Mode</span>
              <span className="text-right">Value</span>
            </div>
            <ul className="flex flex-col gap-1">
              {DAY_PARTS.map((row) => {
                const active = row.id === part.id;
                return (
                  <li
                    key={row.id}
                    aria-current={active ? "true" : undefined}
                    className={`grid grid-cols-[6.2rem_6.2rem_minmax(0,1fr)_2rem] gap-x-2 rounded px-1 font-mono text-[11px] ${
                      active ? "bg-cyan/10 text-cyan" : "text-muted"
                    }`}
                  >
                    <span className={active ? "text-cyan" : "text-foreground"}>{row.label}</span>
                    <span>
                      {clockMinute(row.startMinute)}–{clockMinute(row.endMinute)}
                    </span>
                    <span>{row.mode}</span>
                    <span className="text-right">{row.value}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 px-1">
          <PanelTest label="Send time MIDI once" sent={sent} onClick={() => void testTime()} />
          <PanelSwitch
            label={`Time MIDI ${midiOn ? "on" : "off"}`}
            on={midiOn}
            onClick={() => setTimeMidi(!midiOn)}
          />
        </div>
      </div>
    </section>
  );
}

function groupsOf(channels: OscChannel[]): Array<{ group: string; channels: OscChannel[] }> {
  const groups: Array<{ group: string; channels: OscChannel[] }> = [];
  for (const channel of channels) {
    const last = groups[groups.length - 1];
    if (!last || last.group !== channel.group) {
      groups.push({ group: channel.group, channels: [channel] });
    } else {
      last.channels.push(channel);
    }
  }
  return groups;
}

export function OscLink() {
  const settings = useSyncExternalStore(subscribeOscSettings, getOscSettings, getServerOscSettings);
  const timeOn = useSyncExternalStore(subscribeTimeMidi, getTimeMidi, getServerTimeMidi);
  const anyOn =
    timeOn ||
    OSC_CHANNELS.some((channel) => {
      const setting = settings[channel.id];
      return Boolean(setting?.osc || setting?.midi);
    });

  return (
    <Link
      href="/osc"
      aria-label="OSC and MIDI outputs"
      title={`UDP OSC to ${OSC_HOSTS}. MIDI CC to the IAC Driver.`}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider hover:opacity-80 ${
        anyOn ? "border-cyan text-cyan" : "border-border text-muted hover:border-cyan hover:text-cyan"
      }`}
    >
      {anyOn ? "● OSC · MIDI" : "OSC · MIDI"}
    </Link>
  );
}

export function OscPage({
  initial,
  cadence,
}: {
  initial: BosphorusState | null;
  cadence: Record<string, string>;
}) {
  const [state, setState] = useState(initial);
  const [live, setLive] = useState(false);
  const [portDraft, setPortDraft] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const testGeneration = useRef(0);
  const syncingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const settings = useSyncExternalStore(subscribeOscSettings, getOscSettings, getServerOscSettings);
  const midiStatus = useSyncExternalStore(subscribeMidi, getMidiStatus, getServerMidiStatus);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    const channel = supabase
      .channel("osc-page-state")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bosphorus_state_logs" },
        (payload) => {
          if (cancelled) return;
          setState(rowToState(payload.new as BosphorusStateRow));
        },
      )
      .subscribe((status) => {
        if (!cancelled) setLive(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    void connectMidi();
    return () => releaseMidiBlips();
  }, []);

  useEffect(() => {
    if (syncingRef.current) return;
    if (midiStatus.state !== "ready") return;
    for (const { cc, word } of enabledMidiLevels(state, settings)) {
      sendCc14(cc, word);
    }
  }, [state, settings, midiStatus]);

  useEffect(() => {
    const messages = levelMessages(state, settings);
    if (messages.length === 0) return;
    let cancelled = false;
    void postOsc(messages).then(
      () => {
        if (!cancelled) setSendError(null);
      },
      (error: unknown) => {
        if (!cancelled) {
          setSendError(error instanceof Error ? error.message : "OSC send failed");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [state, settings]);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    const channel = supabase
      .channel("osc-page-vessel-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vessel_events" },
        (payload) => {
          const row = payload.new as VesselEventRow;
          const current = getOscSettings();
          const messages: OscOutbound[] = [];
          const push = (id: string) => {
            const channelDef = oscChannel(id);
            const setting = current[id];
            if (!channelDef || !setting?.osc || !isOscPort(setting.port)) return;
            messages.push({ address: channelDef.address, port: setting.port, value: 1 });
          };
          const blipGate = (id: string) => {
            const cc = enabledGateCc(id, current);
            if (cc != null) blipCc14(cc);
          };
          push("gateAny");
          blipGate("gateAny");
          if (row.gate === "north") {
            push("gateNorth");
            blipGate("gateNorth");
          }
          if (row.gate === "south") {
            push("gateSouth");
            blipGate("gateSouth");
          }
          if (messages.length === 0) return;
          void postOsc(messages).then(
            () => setSendError(null),
            (error: unknown) => {
              setSendError(error instanceof Error ? error.message : "OSC send failed");
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  function portFor(id: string, fallback: number): number | null {
    const draft = portDraft[id];
    if (draft != null && draft !== "") {
      const typed = Number(draft);
      if (isOscPort(typed)) return typed;
    }
    return isOscPort(fallback) ? fallback : null;
  }

  function markSent(token: string) {
    setSentId(token);
    window.setTimeout(() => {
      setSentId((current) => (current === token ? null : current));
    }, 400);
  }

  function testOsc(channel: OscChannel, fallbackPort: number) {
    const port = portFor(channel.id, fallbackPort);
    const value = channel.kind === "bang" ? 1 : levelReading(state, channel.id);
    if (port == null || value == null) {
      setSendError(value == null ? `No ${channel.label} reading to send` : "Port out of range");
      return;
    }
    const message = { address: channel.address, port, value };
    const generation = ++testGeneration.current;
    const token = `${channel.id}:osc`;
    setSendError(null);
    setSentId(token);
    // TouchOSC v2 only stores an address that arrives in the second after Learn.
    void (async () => {
      try {
        for (let i = 0; i < 12; i++) {
          if (testGeneration.current !== generation) return;
          await postOsc([message]);
          if (i < 11) await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch (error) {
        if (testGeneration.current === generation) {
          setSendError(error instanceof Error ? error.message : "OSC send failed");
        }
      } finally {
        if (testGeneration.current === generation) {
          window.setTimeout(() => {
            setSentId((current) => (current === token ? null : current));
          }, 400);
        }
      }
    })();
  }

  function testMidi(channel: OscChannel) {
    if (channel.kind === "bang") {
      blipCc14(channel.cc);
    } else {
      const value = levelReading(state, channel.id);
      if (value == null || !channel.range) {
        setSendError(`No ${channel.label} reading to send`);
        return;
      }
      sendCc14(channel.cc, scaleToMidi14(value, channel.range));
    }
    setSendError(null);
    markSent(`${channel.id}:midi`);
  }

  async function syncMidi() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncNote(null);
    setSendError(null);
    try {
      await connectMidi();
      const midi = getMidiStatus();
      if (midi.state !== "ready") {
        setSendError(midiUnavailable(midi));
        return;
      }

      let source = stateRef.current;
      let usedScreen = false;
      try {
        const pulled = await pullCompiledState();
        if (!pulled) {
          setSendError("No compiled readings yet.");
          return;
        }
        const onScreen = stateRef.current;
        source =
          onScreen && onScreen.createdAt > pulled.createdAt ? onScreen : pulled;
      } catch (error) {
        if (!source) {
          setSendError(error instanceof Error ? error.message : "Could not pull the latest readings");
          return;
        }
        usedScreen = true;
      }

      const levels = snapshotMidiLevels(source);
      if (levels.length === 0) {
        setSendError("No current wind, wave, or traffic readings to send.");
        return;
      }

      const sent = await sendCc14Sequence(levels);
      if (sent === 0) {
        setSendError(midiUnavailable(getMidiStatus()));
        return;
      }

      setState(source);
      const armed = withLevelMidiOn(
        getOscSettings(),
        levels.map((level) => level.id),
      );
      if (armed) updateOscSettings(armed);

      const levelCount = OSC_CHANNELS.filter((channel) => channel.kind === "level").length;
      const when = new Date(source.createdAt).toLocaleTimeString();
      const count = sent === levelCount ? `${sent} readings` : `${sent} of ${levelCount} readings`;
      setSyncNote(
        usedScreen
          ? `Sent ${count} from the screen · ${when}. Hit play.`
          : `Synced ${count} · ${when}. Hit play.`,
      );
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  function commit(id: string, patch: Partial<{ osc: boolean; midi: boolean; port: number }>) {
    const current = getOscSettings();
    updateOscSettings({
      ...current,
      [id]: { ...current[id], ...patch },
    });
  }

  function stepPort(id: string, fallback: number, savedPort: number | undefined, delta: 1 | -1) {
    const current = portFor(id, fallback) ?? fallback;
    const next = Math.min(OSC_PORT_MAX, Math.max(OSC_PORT_MIN, current + delta));
    if (next === savedPort) {
      setPortDraft((prev) => {
        if (!(id in prev)) return prev;
        const cleared = { ...prev };
        delete cleared[id];
        return cleared;
      });
      return;
    }
    setPortDraft((prev) => ({ ...prev, [id]: String(next) }));
    commit(id, { port: next });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">
            Bosphorus
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">OSC · MIDI</h1>
          <p className="mt-1 text-xs text-muted">
            UDP {OSC_HOSTS}
            {state?.createdAt ? ` · ${new Date(state.createdAt).toLocaleString()}` : ""}
            {live ? " · realtime" : " · connecting"}
          </p>
          <MidiStatusLine status={midiStatus} />
          {sendError ? (
            <p className="mt-1 font-mono text-xs text-gold" title={sendError}>
              {sendError}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-gold hover:text-gold"
        >
          ← Dashboard
        </Link>
        <div className="col-span-2 flex items-end justify-between gap-4 border-t border-border pt-3">
          <p className="max-w-xl text-xs text-muted">
            Open the Live set, then Sync all. This pulls the latest compiled wind, wave, sea, and
            traffic onto the mapped CCs and turns those MIDI rows on, so Live stays with the strait
            while you play.
          </p>
          <button
            type="button"
            onClick={() => void syncMidi()}
            disabled={syncing || midiStatus.state === "unsupported"}
            aria-busy={syncing}
            className="shrink-0 rounded-full border border-cyan bg-cyan/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan hover:opacity-80 disabled:opacity-40"
          >
            {syncing ? "Syncing…" : "Sync all"}
          </button>
        </div>
        {syncNote ? (
          <p className="col-span-2 font-mono text-xs text-green">{syncNote}</p>
        ) : null}
      </header>

      <div className="flex flex-col gap-8">
        <TimeMidiPanel onError={setSendError} />
        {groupsOf(OSC_CHANNELS).map((group) => (
          <section key={group.group} className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <h2 className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.25em] text-foreground/80">
                {group.group}
              </h2>
              <div className="h-px flex-1 bg-foreground/25" aria-hidden="true" />
            </div>
            <ul className="overflow-hidden rounded-xl border border-border bg-panel">
              {group.channels.map((channel) => {
                const setting = settings[channel.id];
                const value = levelReading(state, channel.id);
                const shown = formatOscReading(value, channel.kind);
                const word = midiWord(channel, value);
                const span = formatMidiRange(channel);
                const port = setting?.port ?? channel.defaultPort;
                return (
                  <li
                    key={channel.id}
                    className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm text-foreground">
                        {channel.label}
                        <span className="ml-2 font-mono text-muted">
                          {shown}
                          {channel.unit ? ` ${channel.unit}` : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted">{cadence[channel.id]}</p>
                    </div>
                    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                      <OutputColumn
                        title="OSC"
                        actions={
                          <>
                            <PanelTest
                              label={`Send ${channel.label} OSC once`}
                              sent={sentId === `${channel.id}:osc`}
                              onClick={() => testOsc(channel, port)}
                            />
                            <PanelSwitch
                              label={`${channel.label} OSC ${setting?.osc ? "on" : "off"}`}
                              on={setting?.osc ?? false}
                              onClick={() => commit(channel.id, { osc: !setting?.osc })}
                            />
                          </>
                        }
                      >
                        <Fact
                          label="Address"
                          value={
                            <span className="block truncate" title={channel.address}>
                              {channel.address}
                            </span>
                          }
                        />
                        <Fact label="Host" value={OSC_HOSTS} />
                        <Fact
                          label="Port"
                          value={
                            <OscPortInput
                              label={`${channel.label} OSC port`}
                              value={portDraft[channel.id] ?? String(port)}
                              onChange={(raw) => {
                                setPortDraft((prev) => ({ ...prev, [channel.id]: raw }));
                              }}
                              onBlur={(raw) => {
                                setPortDraft((prev) => {
                                  if (!(channel.id in prev)) return prev;
                                  const next = { ...prev };
                                  delete next[channel.id];
                                  return next;
                                });
                                const nextPort = Number(raw);
                                if (!isOscPort(nextPort) || nextPort === setting?.port) return;
                                commit(channel.id, { port: nextPort });
                              }}
                              onStep={(delta) => stepPort(channel.id, port, setting?.port, delta)}
                            />
                          }
                        />
                        <Fact
                          label="Sends"
                          value={
                            channel.kind === "bang"
                              ? "1"
                              : `${shown}${channel.unit ? ` ${channel.unit}` : ""}`
                          }
                        />
                      </OutputColumn>
                      <OutputColumn
                        title="MIDI"
                        actions={
                          <>
                            <PanelTest
                              label={`Send ${channel.label} MIDI once`}
                              sent={sentId === `${channel.id}:midi`}
                              onClick={() => testMidi(channel)}
                            />
                            <PanelSwitch
                              label={`${channel.label} MIDI ${setting?.midi ? "on" : "off"}`}
                              on={setting?.midi ?? false}
                              onClick={() => commit(channel.id, { midi: !setting?.midi })}
                            />
                          </>
                        }
                      >
                        <Fact
                          label="CC / Fine CC"
                          value={
                            <>
                              <span title="Map this controller in Live.">{channel.cc}</span>
                              <span className="text-muted"> / </span>
                              <span title="Low 7 bits of the same 14-bit value.">
                                {channel.cc + 32}
                              </span>
                            </>
                          }
                        />
                        <Fact label="Channel" value={MIDI_CHANNEL + 1} />
                        <Fact
                          label="Full scale"
                          value={
                            span ?? `${MIDI_14BIT_MAX} for ${MIDI_GATE_BLIP_MS} ms`
                          }
                        />
                        <Fact
                          label="Now"
                          value={word != null ? String(word) : channel.kind === "bang" ? "blip" : "—"}
                        />
                      </OutputColumn>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
