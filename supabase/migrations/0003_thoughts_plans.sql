-- My Thoughts: timestamped personal notes attached to journal entries,
-- and Study Plans (Beta): AI-generated, checkable study plans.
-- Owner-only RLS on everything, same model as 0001.

-- ---------------------------------------------------------------------------
-- entry_notes: the user's own pondering, attached to a study
-- ---------------------------------------------------------------------------
create table public.entry_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entry_notes_entry on public.entry_notes (entry_id, created_at);
create index entry_notes_user on public.entry_notes (user_id, created_at desc);

alter table public.entry_notes enable row level security;

create policy "notes_select_own" on public.entry_notes
  for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.entry_notes
  for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.entry_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.entry_notes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- study_plans + plan_items
-- ---------------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  request text not null default '',
  created_at timestamptz not null default now()
);

create index study_plans_user on public.study_plans (user_id, created_at desc);

alter table public.study_plans enable row level security;

create policy "plans_select_own" on public.study_plans
  for select using (auth.uid() = user_id);
create policy "plans_insert_own" on public.study_plans
  for insert with check (auth.uid() = user_id);
create policy "plans_delete_own" on public.study_plans
  for delete using (auth.uid() = user_id);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  title text not null,
  subtitle text not null default '',
  reference text not null default '',
  completed_at timestamptz
);

create index plan_items_plan on public.plan_items (plan_id, position);

alter table public.plan_items enable row level security;

create policy "plan_items_select_own" on public.plan_items
  for select using (auth.uid() = user_id);
create policy "plan_items_insert_own" on public.plan_items
  for insert with check (auth.uid() = user_id);
create policy "plan_items_update_own" on public.plan_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plan_items_delete_own" on public.plan_items
  for delete using (auth.uid() = user_id);
