-- Spindle initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Security model: every table has RLS enabled with owner-only policies.
-- The app talks to Postgres exclusively through the anon key + the user's
-- session JWT, so these policies ARE the authorization layer.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, personalizes study generation
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  calling text not null default '',
  family_context text not null default '',
  study_focus text not null default '',
  spiritual_season text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Keep profile text fields at sane lengths (defense in depth; the app also
-- truncates before sending anything to the model).
alter table public.profiles
  add constraint profiles_field_lengths check (
    char_length(first_name) <= 100
    and char_length(calling) <= 200
    and char_length(family_context) <= 500
    and char_length(study_focus) <= 500
    and char_length(spiritual_season) <= 200
  );

-- ---------------------------------------------------------------------------
-- journal_entries: one row per prepared study
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference text not null,
  volume text not null,
  anchor text not null default '',
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index journal_entries_user_created
  on public.journal_entries (user_id, created_at desc);

alter table public.journal_entries enable row level security;

create policy "journal_select_own" on public.journal_entries
  for select using (auth.uid() = user_id);
create policy "journal_insert_own" on public.journal_entries
  for insert with check (auth.uid() = user_id);
create policy "journal_delete_own" on public.journal_entries
  for delete using (auth.uid() = user_id);
-- No update policy: journal entries are immutable once written.
