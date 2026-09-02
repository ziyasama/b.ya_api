# Radio container

One Docker image: SuperCollider (`sclang` + `scsynth`) on OSC 57121,
`npm run broadcast` with `OSC_MIDI_DRY_RUN=false`, JACK dummy as the sound
card, ffmpeg to MP3 at 96 kbps, Icecast on port 8000.

Railway inbound UDP from the internet is blocked; loopback is not, so the
existing sender in `lib/osc-midi/osc.ts` is unchanged over `127.0.0.1`.

This is a **local** compose file on purpose. The Hobby workspace cannot
isolate this repo from other projects, so this agent will not create a
Railway service for the radio. Run it here, or paste the image into Railway
yourself later.

## First run

1. Invent `ICECAST_SOURCE_PASSWORD` and `ICECAST_ADMIN_PASSWORD` in `.env.local`.
2. Apply `supabase/migrations/0003_vessel_events.sql` so gate bangs can flow.
3. `docker compose -f radio/docker-compose.yml up --build`
4. Stream: `http://localhost:8000/bosphorus`

## Patch slot

See [SIGNAL_CONTRACT.md](SIGNAL_CONTRACT.md). The composer replaces
`radio/patch/live.scd` and sends `/bosphorus/patch/reload`.

## Fallback

If JACK or SuperCollider glitches on a shared vCPU, the start script retries
ffmpeg. Non-real-time 30-second chunks remain the documented fallback; they
are not implemented in this first image.
