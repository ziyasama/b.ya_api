# Background worker

```
npm run worker
```

On Railway this is started by `npm run hub` beside Next.js, one replica.

Single process:

- Open-Meteo marine poll (`OPEN_METEO_POLL_MS`, default 15 min)
- METAR poll (`METAR_POLL_MS`, default 10 min)
- IOC sea level poll (`SEA_LEVEL_POLL_MS`)
- AISStream WebSocket with exponential reconnect
- Persist every `WORKER_PERSIST_MS` (default 120 s)
- Vessel roster upsert every `VESSEL_ROSTER_SAVE_MS`
- Gate-crossing flush every `VESSEL_EVENT_FLUSH_MS` (default 10 s)

No local disk. Logs go to stdout as JSON.

Do not run a local worker at the same time as the Railway hub: two AIS
subscriptions, duplicate rows.
