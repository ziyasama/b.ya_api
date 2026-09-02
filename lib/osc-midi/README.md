# Phase 3 — OSC / MIDI output layer

Consumes the same `BosphorusState` contract (`lib/standardize/types.ts`) as the dashboard.

| File | Role |
| --- | --- |
| `scale.ts` | 0–1 → MIDI CC 0–127 and OSC 0.0–1.0 |
| `mapping.ts` | Field → OSC address / MIDI CC (placeholders until audio-patch review) |
| `osc.ts` | `osc.js` UDP sender (`OSC_HOST` / `OSC_PORT`) |
| `midi.ts` | `easymidi` virtual port (`MIDI_PORT_NAME`) |
| `broadcaster.ts` | Emit one state snapshot, plus gate-crossing bangs |
| `workers/broadcast.ts` | Realtime + poll subscriber |

This process is **local to the installation machine or the radio container**. Do not import it from Next.js client components.

Gate events: see [SIGNAL_CONTRACT.md](../../docs/SIGNAL_CONTRACT.md).
