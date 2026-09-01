# Railway

The web app is stateless. Do not write to the local filesystem at runtime.

## Web service (this `railway.json`)

| Setting | Value |
| --- | --- |
| Build | Nixpacks (detects Next.js) |
| Start | `npm start` (`next start`) |
| Health | HTTP on `$PORT` (Next.js reads `PORT`) |

Copy every key from [`.env.example`](../.env.example) into the Railway variables UI. Do not set `OSC_*` / `MIDI_*` on this service.

## Worker service (second Railway service, same repo)

| Setting | Value |
| --- | --- |
| Start | `npm run worker` |
| Restart | always / on failure |

Needs the same Supabase and API keys. AISStream requires this long-lived process (not a cron one-shot).

## OSC/MIDI

Run `npm run broadcast` on the **installation machine**, not in Railway. Virtual MIDI ports and UDP to Ableton/Max/SuperCollider are local.

## Checklist

- [ ] `npm run build` succeeds in CI / Railway logs
- [ ] `npm start` serves the app with `PORT`
- [ ] Env vars match `.env.example`
- [ ] Worker service is running and inserting into `bosphorus_state_logs`
- [ ] `/dashboard` loads and updates without refresh
