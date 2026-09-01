# Background worker

Run independently of the Next.js UI (Railway second service or `npm run worker`).

```
npm run worker
```

Single process topology (default):

- Open-Meteo REST poll (`OPEN_METEO_POLL_MS`, default 5 min)
- CMEMS/EMODnet REST poll (`CMEMS_POLL_MS`, default 30 min)
- AISStream.io long-lived WebSocket with exponential reconnect
- Combined persist every `WORKER_PERSIST_MS` (default 30 s)

No local disk. Logs go to stdout as JSON.

Split into a second Railway service only if the web process cannot stay alive; AIS requires a persistent socket, so the worker should not be a cron one-shot.
