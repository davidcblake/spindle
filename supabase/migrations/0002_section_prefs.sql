-- Section display preferences: which study sections a user has hidden.
-- Empty array (default) = show everything. Studies always GENERATE all
-- sections; this only controls rendering, so the journal stays complete.
alter table public.profiles
  add column hidden_sections jsonb not null default '[]'::jsonb;
