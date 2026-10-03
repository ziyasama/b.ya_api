# Railway

The web app is stateless. Do not write to the local filesystem at runtime.

## Single service (this `railway.json`)

The collector runs in the same container as the dashboard. A second Railway
service is not required, and must not be added: two replicas (or two
services) means two AIS subscriptions and duplicate rows.

| Setting | Value |
| --- | --- |
| Build | Nixpacks (detects Next.js) |
| Start | `npm run hub` (`next start` + `npm run worker`) |
| Replicas | **1** |
| Restart | on failure |
| Overlap | 0 s so a deploy does not run two workers at once |
| Health | HTTP on `$PORT` (Next.js still binds it) |

The worker needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
on this service. Vessel positions come from Open Waters and need no key.
Do not set `OSC_*` / `MIDI_*`, and do not set Copernicus credentials.

Once Railway logs show `persist.ok`, stop any local `npm run worker` so the
laptop is not a second collector.

## OSC/MIDI

Run `npm run broadcast` on the **installation machine**, not in Railway. Virtual MIDI ports and UDP to Ableton/Max/SuperCollider are local.

## Checklist

- [ ] `npm run build` succeeds in CI / Railway logs
- [ ] `npm run hub` serves the app on `PORT` and logs `persist.ok`
- [ ] Replicas stay at 1
- [ ] Env vars include the two keys plus `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Local `npm run worker` is stopped once Railway is inserting
- [ ] `/` loads and updates without refresh
