-- Phase 2 follow-up:
-- * Reserve usernames that collide with app routes (/profile, /saved, /qr…).
-- * username_changes log (owner-only) → "Former usernames: N" on About this account (page 23).
-- * account_about(user) RPC.

create or replace function public.is_valid_username(name text)
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
      'about', 'accounts', 'admin', 'administrator', 'api', 'archive', 'create', 'dev', 'direct',
      'explore', 'favorites', 'help', 'highlights', 'humans', 'instagram', 'legal', 'login',
      'logout', 'null', 'p', 'profile', 'qr', 'reel', 'reels', 'root', 'saved', 'settings',
      'signup', 'stories', 'support', 'undefined', 'www'
    ]);
$$;

create table public.username_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_at timestamptz not null default now()
);

create index username_changes_user_idx on public.username_changes (user_id, changed_at desc);

alter table public.username_changes enable row level security;

-- The owner sees their own history (Your activity → Account history, later). Others only get
-- the count through account_about().
create policy username_changes_select_owner on public.username_changes
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.username_changes from anon, authenticated;

create function public.profiles_log_username_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.username_changes (user_id, old_username, new_username)
  values (new.id, old.username, new.username);
  return new;
end;
$$;

create trigger profiles_log_username_change
  after update of username on public.profiles
  for each row
  when (old.username is distinct from new.username)
  execute function public.profiles_log_username_change();

-- About this account (page 23): date joined + number of username changes.
create function public.account_about(p_user_id uuid)
returns table (
  id uuid,
  username text,
  avatar_path text,
  date_joined timestamptz,
  former_usernames_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar_path, p.created_at,
    (select count(*)::int from public.username_changes c where c.user_id = p.id)
  from public.profiles p
  where p.id = p_user_id and auth.uid() is not null;
$$;

revoke execute on function public.profiles_log_username_change() from public, anon, authenticated;
revoke execute on function public.account_about(uuid) from public, anon;
grant execute on function public.account_about(uuid) to authenticated;
