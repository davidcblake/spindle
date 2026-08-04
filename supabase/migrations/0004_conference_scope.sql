-- How broadly to source general-conference teachings.
--   'core'     = current First Presidency + Quorum of the Twelve only (default)
--   'expanded' = also past First Presidency/Twelve/prophets and other general
--                authorities & officers from the last ~10-12 years, always
--                prioritizing the current First Presidency and Twelve.
alter table public.profiles
  add column conference_scope text not null default 'core'
    check (conference_scope in ('core', 'expanded'));
