-- Bosphorus Data Aggregation Hub
-- Append-only time-series. Never delete rows (enforced by trigger).
-- Apply in the Supabase SQL editor after reviewing this DDL.

create extension if not exists "pgcrypto";

create table if not exists public.bosphorus_state_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  wind_speed double precision,
  wave_height double precision,
  sea_surface_temp double precision,
  current_direction double precision,
  current_u double precision,
  current_v double precision,
  salinity double precision,
  water_density double precision,
  vessel_count integer,
  vessel_data jsonb not null default '[]'::jsonb,
  source_status jsonb not null default '{}'::jsonb,
  normalized jsonb not null default '{}'::jsonb
);

create index if not exists bosphorus_state_logs_created_at_idx
  on public.bosphorus_state_logs (created_at desc);

comment on table public.bosphorus_state_logs is
  'Append-only Bosphorus environmental/maritime snapshots for dashboard + OSC/MIDI.';

-- ---------------------------------------------------------------------------
-- Append-only: reject DELETE and UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.bosphorus_state_logs_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'bosphorus_state_logs is append-only';
end;
$$;

drop trigger if exists bosphorus_state_logs_no_delete on public.bosphorus_state_logs;
create trigger bosphorus_state_logs_no_delete
  before delete on public.bosphorus_state_logs
  for each row execute function public.bosphorus_state_logs_append_only();

drop trigger if exists bosphorus_state_logs_no_update on public.bosphorus_state_logs;
create trigger bosphorus_state_logs_no_update
  before update on public.bosphorus_state_logs
  for each row execute function public.bosphorus_state_logs_append_only();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- service_role bypasses RLS by default and is the only writer (worker).
-- anon/authenticated may SELECT so the password-gated panel can subscribe.
-- ---------------------------------------------------------------------------
alter table public.bosphorus_state_logs enable row level security;

drop policy if exists "bosphorus_state_logs_select" on public.bosphorus_state_logs;
create policy "bosphorus_state_logs_select"
  on public.bosphorus_state_logs
  for select
  to anon, authenticated
  using (true);

grant select on public.bosphorus_state_logs to anon, authenticated;
grant all on public.bosphorus_state_logs to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: live dashboard + local OSC/MIDI broadcaster
-- ---------------------------------------------------------------------------
alter table public.bosphorus_state_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bosphorus_state_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.bosphorus_state_logs';
  end if;
end
$$;
