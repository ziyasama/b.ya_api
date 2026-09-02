-- Bosphorus Data Aggregation Hub — migration 0002
--
-- Reshapes the log around the reduced signal set (wind, wave, current,
-- water temperature, vessels) and around measured sources where one exists.
--
-- Background, from source testing on 2 Sep 2026:
--   * The marine wave model has no grid cell inside the strait, so the old
--     single sample point snapped ~9 km south into the Sea of Marmara and
--     reported 0.04 m. Waves are now sampled at the northern mouth, and the
--     cell the API actually used is recorded in sample_lat/sample_lon.
--   * Model wind read 2.97 m/s while three Istanbul anemometers read
--     5.1-6.2 m/s. Wind now prefers measured METAR; wind_source says which.
--   * current_u/current_v were null in every row ever written, and
--     normalize() maps null to 0, so the dashboard showed a dead-calm strait
--     as fact. Replaced by measured sea level either side of the strait; the
--     Black Sea minus Marmara head is what drives the surface flow.
--
-- Adding nullable columns is safe against the append-only triggers, which
-- guard row DELETE and UPDATE rather than DDL.
--
-- Apply in the Supabase SQL editor after reviewing this DDL.

-- ---------------------------------------------------------------------------
-- New signals on the state log
-- ---------------------------------------------------------------------------
alter table public.bosphorus_state_logs
  add column if not exists wind_direction double precision,
  add column if not exists wind_source text,
  add column if not exists wave_period double precision,
  add column if not exists wave_direction double precision,
  add column if not exists swell_height double precision,
  add column if not exists sample_lat double precision,
  add column if not exists sample_lon double precision,
  add column if not exists sea_level_black_sea double precision,
  add column if not exists sea_level_marmara double precision,
  add column if not exists sea_level_head double precision,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists available jsonb not null default '{}'::jsonb;

comment on column public.bosphorus_state_logs.wind_source is
  '"metar" when measured by airport anemometers, "model" when Open-Meteo stood in.';
comment on column public.bosphorus_state_logs.sample_lat is
  'Grid cell the marine model actually used, not the cell requested. Guards against silent displacement.';
comment on column public.bosphorus_state_logs.sea_level_black_sea is
  'Metres against the Black Sea gauge''s own rolling mean. Gauges sit on differing local datums, so only anomalies are comparable.';
comment on column public.bosphorus_state_logs.sea_level_head is
  'Black Sea anomaly minus Marmara anomaly, metres. The physical driver of the strait''s surface flow; positive drives water south.';
comment on column public.bosphorus_state_logs.available is
  'Per-signal presence flags, so a normalized 0 caused by a missing source is distinguishable from a genuine calm.';
comment on column public.bosphorus_state_logs.provenance is
  'Per-signal source, whether measured or modelled, and observation age at insert time.';

-- Retired with the CMEMS ocean column. Left in place and still written as
-- null, because they were always null anyway so nothing regresses, and
-- dropping them buys a fight with the append-only triggers for no benefit.
-- Retire for real once no consumer references them.
comment on column public.bosphorus_state_logs.salinity is
  'RETIRED Sep 2026. Always null. Signal set simplified to wind, wave, current, temperature, vessels.';
comment on column public.bosphorus_state_logs.water_density is
  'RETIRED Sep 2026. Always null.';
comment on column public.bosphorus_state_logs.current_u is
  'RETIRED Sep 2026. Always null, and always was. See sea_level_head for the measured current driver.';
comment on column public.bosphorus_state_logs.current_v is
  'RETIRED Sep 2026. Always null, and always was.';
comment on column public.bosphorus_state_logs.current_direction is
  'RETIRED Sep 2026. Always null, and always was.';

-- ---------------------------------------------------------------------------
-- Durable vessel roster
--
-- AISStream is event-driven and the worker kept vessels only in memory, so
-- every restart reset the strait to empty and the first rows after a deploy
-- carried vessel_data = []. This table lets the worker rehydrate on boot.
--
-- Deliberately NOT append-only: it is current state keyed by MMSI, upserted
-- in place. The history lives in bosphorus_state_logs.
-- ---------------------------------------------------------------------------
create table if not exists public.vessel_positions (
  mmsi text primary key,
  lat double precision not null,
  lon double precision not null,
  size double precision,
  ship_name text,
  ship_type integer,
  last_seen timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists vessel_positions_last_seen_idx
  on public.vessel_positions (last_seen desc);

comment on table public.vessel_positions is
  'Current vessel roster keyed by MMSI. Survives worker restarts so the AIS picture does not rebuild from zero.';

alter table public.vessel_positions enable row level security;

drop policy if exists "vessel_positions_select" on public.vessel_positions;
create policy "vessel_positions_select"
  on public.vessel_positions
  for select
  to anon, authenticated
  using (true);

grant select on public.vessel_positions to anon, authenticated;
grant all on public.vessel_positions to service_role;
