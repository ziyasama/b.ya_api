# Database & Authentication Rules (Supabase)

## Schema Design (Single Source of Truth)
- Use Supabase Postgres. 
- Create a strict schema for `bosphorus_state_logs` with columns for timestamp, wind_speed, wave_height, current_direction, and vessel_count.
- Never delete old logs; this is a time-series database.

## Authentication (Protected Panel)
- The dashboard must not be entirely public initially. Implement a simple password-protection layer for the `/dashboard` route.
- Use Next.js Middleware with a hardcoded environment variable (e.g., `PANEL_PASSWORD`) or basic Supabase Auth to restrict access.

## Client Usage
- Use `@supabase/supabase-js`.
- Always instantiate the Supabase client securely, avoiding exposure of the `SERVICE_ROLE_KEY` on the client side.

## Locked decisions
- Panel auth is Next.js Middleware + HMAC cookie gated by `PANEL_PASSWORD` (not Supabase Auth).
- Schema lives in `supabase/migrations/0001_bosphorus_state_logs.sql` (append-only triggers, RLS select for anon, Realtime publication).
- Cloud Supabase (not self-hosted) for MVP.