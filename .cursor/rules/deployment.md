# Deployment Rules (Railway)

## Environment Variables
- Keep `.env.local` strictly out of version control.
- Ensure all required variables (Supabase URL, API Keys, Panel Password) are clearly documented in an `.env.example` file so they can be easily copy-pasted into the Railway dashboard.

## Build & Start Commands
- Ensure standard `npm run build` and `npm start` scripts work flawlessly.
- Do not use any local filesystem dependencies that would break in a stateless containerized environment like Railway.

## Locked decisions
- Package manager: npm. No `src/` directory.
- Web service: `npm start`. Worker service: `npm run worker` (same repo, second Railway service).
- Env template: `.env.example`. See `docs/RAILWAY.md`.