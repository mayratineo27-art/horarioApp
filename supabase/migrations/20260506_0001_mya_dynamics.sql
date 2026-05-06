create extension if not exists "pgcrypto";

create table if not exists public.user_configs (
  id integer primary key,
  timezone text not null default 'America/Santo_Domingo',
  schedule jsonb not null default '[]'::jsonb,
  subscription jsonb,
  sent_by_date jsonb not null default '{}'::jsonb,
  notification_hour_start integer not null default 7,
  notification_hour_end integer not null default 22,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_configs
  add column if not exists notification_hour_start integer not null default 7,
  add column if not exists notification_hour_end integer not null default 22,
  add column if not exists sent_by_date jsonb not null default '{}'::jsonb,
  add column if not exists timezone text not null default 'America/Santo_Domingo',
  add column if not exists schedule jsonb not null default '[]'::jsonb,
  add column if not exists subscription jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_configs
set
  timezone = coalesce(timezone, 'America/Santo_Domingo'),
  schedule = coalesce(schedule, '[]'::jsonb),
  sent_by_date = coalesce(sent_by_date, '{}'::jsonb),
  notification_hour_start = coalesce(notification_hour_start, 7),
  notification_hour_end = coalesce(notification_hour_end, 22),
  updated_at = now()
where id = 1;

insert into public.user_configs (id, timezone, schedule, subscription, sent_by_date, notification_hour_start, notification_hour_end)
values (1, 'America/Santo_Domingo', '[]'::jsonb, null, '{}'::jsonb, 7, 22)
on conflict (id) do nothing;

create table if not exists public.fixed_courses (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  course_code text not null,
  name text not null,
  category text not null,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  es_fijo boolean not null default true,
  is_exercise boolean not null default false,
  emoji text,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixed_courses_user_key_idx on public.fixed_courses (user_key);
create index if not exists fixed_courses_day_idx on public.fixed_courses (user_key, day_of_week);
create index if not exists fixed_courses_code_idx on public.fixed_courses (user_key, course_code);

create table if not exists public.course_checklists (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  course_id uuid not null references public.fixed_courses(id) on delete cascade,
  course_code text not null,
  items jsonb not null default '[]'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_key, course_id)
);

create index if not exists course_checklists_user_key_idx on public.course_checklists (user_key);
create index if not exists course_checklists_course_idx on public.course_checklists (course_id);
create index if not exists course_checklists_code_idx on public.course_checklists (user_key, course_code);

alter table public.fixed_courses enable row level security;
alter table public.course_checklists enable row level security;

drop policy if exists "Allow authenticated read fixed courses" on public.fixed_courses;
create policy "Allow authenticated read fixed courses" on public.fixed_courses
for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated write fixed courses" on public.fixed_courses;
create policy "Allow authenticated write fixed courses" on public.fixed_courses
for all using (auth.role() = 'authenticated' or auth.role() = 'anon')
with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated read checklists" on public.course_checklists;
create policy "Allow authenticated read checklists" on public.course_checklists
for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated write checklists" on public.course_checklists;
create policy "Allow authenticated write checklists" on public.course_checklists
for all using (auth.role() = 'authenticated' or auth.role() = 'anon')
with check (auth.role() = 'authenticated' or auth.role() = 'anon');