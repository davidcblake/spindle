-- Feedback from the iPhone app, and telling the server when an iPhone is new
-- (decision 0006). Run in the Supabase SQL editor after 0005.
--
-- Same arrangement as 0005: RLS on with no policies, reached only through
-- security-definer functions that check the server's secret first.

create table public.app_feedback (
  id bigint generated always as identity primary key,
  key_id text references public.device_keys (key_id) on delete set null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;

-- Feedback is limited per hour like studies and plans, so it counts as a use.
alter table public.device_usage drop constraint device_usage_kind_check;
alter table public.device_usage add constraint device_usage_kind_check
  check (kind in ('study', 'plan', 'feedback'));

create function public.app_save_feedback(p_secret text, p_key_id text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_secret(p_secret);
  insert into public.app_feedback (key_id, message) values (p_key_id, p_message);
end;
$$;
grant execute on function public.app_save_feedback(text, text, text) to anon;

-- Registering a key now says whether it was new, so the server can send the
-- "new iPhone" alert once per install. The return type changes, so the old
-- function is dropped first.
drop function public.app_register_key(text, text, text);
create function public.app_register_key(p_secret text, p_key_id text, p_public_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_secret(p_secret);
  insert into public.device_keys (key_id, public_key) values (p_key_id, p_public_key)
  on conflict (key_id) do nothing;
  return found;
end;
$$;
grant execute on function public.app_register_key(text, text, text) to anon;

-- To read feedback in the SQL editor:
--   select created_at, message from public.app_feedback order by created_at desc;
