-- Phase 1 — Onboarding & Authentication (pages 1–13, 15; page 14 / 2FA deferred).
--
-- Accounts are EMAIL ONLY (decision 2026-10-05). Sign-up flow:
--   email OTP (auth.users row, no profile yet) → password → birthday → name → username
--   → "I agree" calls complete_signup() which creates profiles + account_private atomically.
-- A session without a profiles row = unfinished sign-up; the app resumes onboarding.
--
-- Also creates the minimal `follows` stub (owned by Phase 2) for page 11's Follow buttons.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Username rules (Instagram): ≤30 chars, a–z 0–9 . _, no "..", no leading/trailing ".",
-- stored lowercase, not reserved.
-- ---------------------------------------------------------------------------------------------
create function public.is_valid_username(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select name is not null
    and char_length(name) between 1 and 30
    and name ~ '^[a-z0-9._]+$'
    and position('..' in name) = 0
    and left(name, 1) <> '.'
    and right(name, 1) <> '.'
    and name <> all (array[
      'about', 'accounts', 'admin', 'administrator', 'api', 'direct', 'explore', 'help',
      'humans', 'instagram', 'login', 'logout', 'null', 'p', 'reel', 'reels', 'root',
      'settings', 'signup', 'stories', 'support', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles — public (to signed-in users) identity. 1:1 with auth.users.
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_valid check (public.is_valid_username(username)),
  constraint profiles_full_name_length check (char_length(full_name) <= 64),
  constraint profiles_avatar_path_owner check (
    avatar_path is null or split_part(avatar_path, '/', 1) = id::text
  )
);

comment on table public.profiles is 'Public profile. Created only by complete_signup().';

alter table public.profiles enable row level security;

create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are created by complete_signup(); deletion comes with
-- account deletion (Phase 11). Clients may only update these columns:
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, full_name, avatar_path) on public.profiles to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- account_private — owner-only data that must never be on the public profile.
-- ---------------------------------------------------------------------------------------------
create table public.account_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birthday date not null,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint account_private_birthday_range check (birthday > date '1900-01-01')
);

alter table public.account_private enable row level security;

create policy account_private_select_owner on public.account_private
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Written only by complete_signup() (enforces the 13+ rule); birthday edits come with Phase 11.
revoke insert, update, delete on public.account_private from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- follows — MINIMAL STUB for page 11 (owned by Phase 2, which adds follow requests for private
-- accounts, counters, and notifications).
-- ---------------------------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index follows_following_id_idx on public.follows (following_id);

alter table public.follows enable row level security;

create policy follows_select_authenticated on public.follows
  for select to authenticated
  using (true);

create policy follows_insert_owner on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy follows_delete_owner on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

revoke update on public.follows from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- contact_hashes — synced device contacts, stored ONLY as SHA-256 of the lowercased email.
-- ---------------------------------------------------------------------------------------------
create table public.contact_hashes (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, hash),
  constraint contact_hashes_sha256 check (hash ~ '^[0-9a-f]{64}$')
);

alter table public.contact_hashes enable row level security;

create policy contact_hashes_select_owner on public.contact_hashes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy contact_hashes_insert_owner on public.contact_hashes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy contact_hashes_delete_owner on public.contact_hashes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke update on public.contact_hashes from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Page 8: live availability check.
create function public.username_available(name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_valid_username(name)
    and not exists (select 1 from public.profiles p where p.username = name);
$$;

-- Page 8: suggestions derived from the full name, all valid and currently free.
create function public.suggest_usernames(full_name text, max_count int default 4)
returns text[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  words text[];
  base text;
  candidate text;
  result text[] := '{}'::text[];
  attempts int := 0;
begin
  words := array_remove(
    regexp_split_to_array(trim(regexp_replace(lower(extensions.unaccent(coalesce(full_name, ''))), '[^a-z0-9 ]', '', 'g')), '\s+'),
    ''
  );
  base := left(coalesce(array_to_string(words, ''), ''), 24);
  if base = '' then
    base := 'user';
  end if;

  foreach candidate in array array[
    base,
    left(array_to_string(words, '.'), 30),
    left(array_to_string(words, '_'), 30),
    base || '_',
    '_' || base
  ] loop
    exit when cardinality(result) >= max_count;
    if candidate <> '' and public.username_available(candidate) and not candidate = any (result) then
      result := result || candidate;
    end if;
  end loop;

  while cardinality(result) < max_count and attempts < 40 loop
    attempts := attempts + 1;
    candidate := base || (floor(random() * 9000) + 100)::int::text;
    if public.username_available(candidate) and not candidate = any (result) then
      result := result || candidate;
    end if;
  end loop;

  return result;
end;
$$;

-- Page 9: "I agree" — creates the account (profile + private data) atomically.
create function public.complete_signup(p_username text, p_full_name text, p_birthday date)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.profiles;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'already_completed' using errcode = '23505';
  end if;
  if p_birthday is null or p_birthday > (current_date - interval '13 years')::date then
    raise exception 'too_young' using errcode = '22023';
  end if;
  if not public.is_valid_username(lower(trim(p_username))) then
    raise exception 'invalid_username' using errcode = '22023';
  end if;

  insert into public.account_private (user_id, birthday, terms_accepted_at)
  values (uid, p_birthday, now());

  insert into public.profiles (id, username, full_name)
  values (uid, lower(trim(p_username)), left(coalesce(trim(p_full_name), ''), 64))
  returning * into result;

  return result;
exception
  when unique_violation then
    -- Username taken between the availability check and "I agree".
    raise exception 'username_taken' using errcode = '23505';
end;
$$;

-- Page 11: follow suggestions — contacts first, then the most-followed accounts.
create function public.suggested_accounts(max_count int default 30)
returns table (id uuid, username text, full_name text, avatar_path text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with contacts as (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex') in (
      select c.hash from public.contact_hashes c where c.owner_id = auth.uid()
    )
  ),
  follower_counts as (
    select f.following_id, count(*) as n from public.follows f group by f.following_id
  )
  select p.id, p.username, p.full_name, p.avatar_path,
    case when p.id in (select id from contacts) then 'contact' else 'popular' end as reason
  from public.profiles p
  left join follower_counts fc on fc.following_id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    )
  order by (p.id in (select id from contacts)) desc, coalesce(fc.n, 0) desc, p.created_at desc
  limit least(greatest(max_count, 1), 100);
$$;

-- Edge Function `account-auth` only (service role): resolve a username or email to the account.
-- Never callable by clients — it returns the email behind a username.
create function public.auth_lookup(identifier text)
returns table (user_id uuid, email text, username text, has_profile boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, p.username, p.id is not null
  from auth.users u
  left join public.profiles p on p.id = u.id
  where case
    when position('@' in identifier) > 0 then lower(u.email) = lower(trim(identifier))
    else p.username = lower(trim(identifier))
  end
  limit 1;
$$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges: nothing for anon; auth_lookup for service_role only.
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.is_valid_username(text) from public, anon;
revoke execute on function public.username_available(text) from public, anon;
revoke execute on function public.suggest_usernames(text, int) from public, anon;
revoke execute on function public.complete_signup(text, text, date) from public, anon;
revoke execute on function public.suggested_accounts(int) from public, anon;
revoke execute on function public.auth_lookup(text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.is_valid_username(text) to authenticated;
grant execute on function public.username_available(text) to authenticated;
grant execute on function public.suggest_usernames(text, int) to authenticated;
grant execute on function public.complete_signup(text, text, date) to authenticated;
grant execute on function public.suggested_accounts(int) to authenticated;
grant execute on function public.auth_lookup(text) to service_role;
