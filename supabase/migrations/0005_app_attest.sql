-- The iPhone app's attested keys and usage (decisions 0002, 0003, 0004).
-- Run in the Supabase SQL editor, then set the server secret (bottom).
--
-- These callers have no Supabase user, so owner-only RLS has nobody to be the
-- owner. Instead the tables have RLS on and NO policies — nobody can touch
-- them through the API at all — and the only way in is the security-definer
-- functions below, each of which first checks a secret only the Vercel server
-- holds. Decision 0004 explains why this, rather than a service-role key.

create table public.app_challenges (
  challenge text primary key,
  created_at timestamptz not null default now()
);

create table public.device_keys (
  key_id text primary key,
  public_key text not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.device_usage (
  id bigint generated always as identity primary key,
  key_id text not null references public.device_keys (key_id) on delete cascade,
  kind text not null check (kind in ('study', 'plan')),
  created_at timestamptz not null default now()
);
create index device_usage_recent on public.device_usage (key_id, kind, created_at desc);

-- Holds one row: the SHA-256 of the server's secret, never the secret itself.
create table public.app_server_secret (
  secret_hash text not null
);

alter table public.app_challenges enable row level security;
alter table public.device_keys enable row level security;
alter table public.device_usage enable row level security;
alter table public.app_server_secret enable row level security;
revoke all on public.app_challenges, public.device_keys, public.device_usage,
  public.app_server_secret from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The gate every function passes through first.
-- ---------------------------------------------------------------------------
create function public.app_require_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_server_secret
    where secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.app_require_secret(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Challenges: issued for registering a key, good once, for five minutes.
-- ---------------------------------------------------------------------------
create function public.app_issue_challenge(p_secret text, p_challenge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_secret(p_secret);
  delete from public.app_challenges where created_at < now() - interval '5 minutes';
  insert into public.app_challenges (challenge) values (p_challenge);
end;
$$;

create function public.app_take_challenge(p_secret text, p_challenge text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  found_one boolean;
begin
  perform public.app_require_secret(p_secret);
  delete from public.app_challenges
  where challenge = p_challenge and created_at >= now() - interval '5 minutes'
  returning true into found_one;
  return coalesce(found_one, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Keys: registered once per install, after the attestation is checked.
-- ---------------------------------------------------------------------------
create function public.app_register_key(p_secret text, p_key_id text, p_public_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_secret(p_secret);
  insert into public.device_keys (key_id, public_key) values (p_key_id, p_public_key)
  on conflict (key_id) do nothing;
end;
$$;

create function public.app_key(p_secret text, p_key_id text)
returns table (public_key text, counter bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_secret(p_secret);
  return query select k.public_key, k.counter from public.device_keys k where k.key_id = p_key_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- One use of a key: the counter must go up (that is what stops a captured
-- request being replayed), and the hour's limit must not be reached. Done in
-- one statement-level lock so two requests at once cannot both slip through.
-- Returns 'ok', 'unknown', 'replay' or 'limit'.
-- ---------------------------------------------------------------------------
create function public.app_use_key(
  p_secret text, p_key_id text, p_counter bigint, p_kind text, p_hourly_limit int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  stored bigint;
  recent int;
begin
  perform public.app_require_secret(p_secret);
  select counter into stored from public.device_keys where key_id = p_key_id for update;
  if not found then
    return 'unknown';
  end if;
  if p_counter <= stored then
    return 'replay';
  end if;
  update public.device_keys set counter = p_counter where key_id = p_key_id;

  select count(*) into recent from public.device_usage
  where key_id = p_key_id and kind = p_kind and created_at > now() - interval '1 hour';
  if recent >= p_hourly_limit then
    return 'limit';
  end if;
  insert into public.device_usage (key_id, kind) values (p_key_id, p_kind);
  return 'ok';
end;
$$;

grant execute on function public.app_issue_challenge(text, text) to anon;
grant execute on function public.app_take_challenge(text, text) to anon;
grant execute on function public.app_register_key(text, text, text) to anon;
grant execute on function public.app_key(text, text) to anon;
grant execute on function public.app_use_key(text, text, bigint, text, int) to anon;

-- ---------------------------------------------------------------------------
-- After running this file, once, with a long random secret that you also set
-- as APP_SERVER_SECRET in Vercel (e.g. from `openssl rand -base64 48`):
--
--   insert into public.app_server_secret (secret_hash)
--   values (encode(extensions.digest('PASTE-THE-SECRET-HERE', 'sha256'), 'hex'));
-- ---------------------------------------------------------------------------
