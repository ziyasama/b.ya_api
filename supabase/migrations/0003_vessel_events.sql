-- Discrete vessel events: gate crossings at the Port of Istanbul mouths.
--
-- The north line is Rumeli Feneri to Anadolu Feneri (Black Sea entrance).
-- The south line is Ahırkapı Feneri to Kadıköy İnciburnu Feneri (Marmara
-- entrance). Those lighthouse pairs are the published port boundaries, not
-- guessed latitudes. Direction is the sign of the vessel's own latitude
-- change between AIS fixes: northbound to the Black Sea, southbound to the
-- Marmara. A missing previous fix is not an event.
--
-- Append-only, like bosphorus_state_logs. Realtime so a percussive voice
-- can fire on INSERT rather than polling a slowly drifting count.
--
-- Apply in the Supabase SQL editor after reviewing this DDL.

create table if not exists public.vessel_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mmsi text not null,
  ship_name text,
  gate text not null check (gate in ('north', 'south')),
  direction text not null check (direction in ('northbound', 'southbound')),
  lat double precision not null,
  lon double precision not null,
  crossed_at timestamptz not null
);

create index if not exists vessel_events_crossed_at_idx
  on public.vessel_events (crossed_at desc);

create index if not exists vessel_events_mmsi_idx
  on public.vessel_events (mmsi, crossed_at desc);

comment on table public.vessel_events is
  'Timestamped gate crossings at the Port of Istanbul lighthouse lines. Direction is the sign of latitude change, never an invented speed.';

create or replace function public.vessel_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'vessel_events is append-only';
end;
$$;

drop trigger if exists vessel_events_no_delete on public.vessel_events;
create trigger vessel_events_no_delete
  before delete on public.vessel_events
  for each row execute function public.vessel_events_append_only();

drop trigger if exists vessel_events_no_update on public.vessel_events;
create trigger vessel_events_no_update
  before update on public.vessel_events
  for each row execute function public.vessel_events_append_only();

alter table public.vessel_events enable row level security;

drop policy if exists "vessel_events_select" on public.vessel_events;
create policy "vessel_events_select"
  on public.vessel_events
  for select
  to anon, authenticated
  using (true);

grant select on public.vessel_events to anon, authenticated;
grant all on public.vessel_events to service_role;

alter table public.vessel_events replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vessel_events'
  ) then
    execute 'alter publication supabase_realtime add table public.vessel_events';
  end if;
end
$$;
