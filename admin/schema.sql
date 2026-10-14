-- ===========================================================
-- Go Jam Studio OS — database schema (run once in Supabase)
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to re-run; it drops and recreates policies.
-- ===========================================================

-- ---------- team members (one row per login) ----------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'member',   -- 'owner' | 'member'
  created_at  timestamptz not null default now()
);

-- auto-create a profile whenever someone is added to auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- clients ----------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text default 'artist',            -- 'artist' | 'brand' | 'other'
  email       text,
  phone       text,
  instagram   text,
  status      text not null default 'active',    -- 'lead' | 'active' | 'past'
  tags        text[] default '{}',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- ---------- projects (a job for a client) ----------
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  title       text not null,
  status      text not null default 'enquiry',   -- enquiry|onboarding|in_production|delivered|follow_up|closed
  description text,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- deliveries (records each delivery link sent) ----------
create table if not exists deliveries (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id) on delete set null,
  client_id       uuid references clients(id) on delete cascade,
  title           text,
  delivery_link   text,
  drive_folder_id text,
  drive_video_id  text,
  portrait        boolean default false,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------- onboarding / project checklist steps ----------
create table if not exists project_steps (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  order_index  int not null default 0,
  done_at      timestamptz
);

-- ---------- follow-ups (reminders / nudges) ----------
create table if not exists follow_ups (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,
  kind          text not null default 'check_in', -- review|check_in|lead_nudge
  due_date      date,
  status        text not null default 'pending',  -- pending|done|dismissed
  draft_message text,
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);

-- ---------- row level security: trusted team, login required ----------
alter table profiles      enable row level security;
alter table clients       enable row level security;
alter table projects      enable row level security;
alter table deliveries    enable row level security;
alter table project_steps enable row level security;
alter table follow_ups    enable row level security;

drop policy if exists "read profiles"    on profiles;
drop policy if exists "update own"       on profiles;
drop policy if exists "team clients"     on clients;
drop policy if exists "team projects"    on projects;
drop policy if exists "team deliveries"  on deliveries;
drop policy if exists "team steps"       on project_steps;
drop policy if exists "team followups"   on follow_ups;

create policy "read profiles"   on profiles      for select to authenticated using (true);
create policy "update own"      on profiles      for update to authenticated using (auth.uid() = id);
create policy "team clients"    on clients       for all    to authenticated using (true) with check (true);
create policy "team projects"   on projects      for all    to authenticated using (true) with check (true);
create policy "team deliveries" on deliveries    for all    to authenticated using (true) with check (true);
create policy "team steps"      on project_steps for all    to authenticated using (true) with check (true);
create policy "team followups"  on follow_ups    for all    to authenticated using (true) with check (true);
