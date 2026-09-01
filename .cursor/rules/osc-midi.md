# OSC & MIDI Integration Rules

## Architecture & Timeline Context
- This module is the ultimate output layer of the system. While robust data aggregation and database logging are the immediate priorities (Phase 1), the codebase must be structured to support seamless OSC/MIDI broadcasting (Phase 2) from day one.

## Signal Translation & Broadcasting
- The standardized `BosphorusState` data will continuously trigger events in external local audio software (Ableton Live, Max/MSP, SuperCollider).
- Utilize Node.js libraries such as `osc.js` (for UDP Open Sound Control messages) and `easymidi` (for virtual MIDI ports).

## Data Mapping Standards
- Ensure numerical data fetched from the database can be easily interpolated into usable audio control ranges.
- MIDI mapping requirement: Implement utility functions to scale raw environmental values into integers between 0 and 127 (MIDI CC standard).
- OSC mapping requirement: Implement utility functions to scale raw values into normalized floating-point numbers (0.0 to 1.0) for spatial panning and granular synth parameters.

## Locked decisions
- OSC/MIDI runs on the installation machine (`npm run broadcast`), not inside the Railway web container.
- Default mapping table: `lib/osc-midi/mapping.ts` (MIDI CC 1–10, `/bosphorus/...` OSC addresses). Tune with the audio patch.
- `easymidi` is an optionalDependency so Railway `npm install` can succeed without native MIDI.