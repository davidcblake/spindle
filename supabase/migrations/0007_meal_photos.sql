-- Stackd's meal photos (decision 0007). Run in the Supabase SQL editor after 0006.
--
-- Stackd's iPhone keys live in the same device_keys table as Spindle's: a key is
-- attested for one app's App ID, and every request is checked against that same
-- App ID, so a key can only ever be used by the app it was made for.
--
-- A meal photo counts as a use, limited per hour like studies and plans.
alter table public.device_usage drop constraint device_usage_kind_check;
alter table public.device_usage add constraint device_usage_kind_check
  check (kind in ('study', 'plan', 'feedback', 'meal'));
