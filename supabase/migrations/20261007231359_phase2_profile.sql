-- Phase 2 — Profile (pages 16–27, 30, 31; 28/29 deferred). Decisions: docs/DECISIONS.md 2026-10-08.
--
-- * profiles: bio, links, is_private + follower/following/post counters (kept by triggers).
-- * Private accounts: follow_requests, can_view_profile(), follow_user()/approve_follow_request().
--   Going public auto-approves pending requests.
-- * follows (Phase 1 stub) finished: visibility follows privacy, remove-follower, counters.
-- * close_friends, favorites (max 50, must follow), profile_notification_prefs (bell).
-- * highlights (row only; items + editor come with stories in Phase 5).
-- * saved_collections / saved_collection_items (post FK added by Phase 3).

-- ---------------------------------------------------------------------------------------------
-- profiles: new public fields
-- ---------------------------------------------------------------------------------------------

-- Up to 5 links: [{ "url": "https://…", "title": "optional" }].
create function public.is_valid_profile_links(links jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 5
    and not exists (
      select 1
      from jsonb_array_elements(links) e
      where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'url', '') !~* '^https?://[^\s/?#]+\.[^\s]+$'
        or char_length(e ->> 'url') > 2048
        or char_length(coalesce(e ->> 'title', '')) > 60
    );
$$;

alter table public.profiles
  add column bio text not null default '',
  add column links jsonb not null default '[]'::jsonb,
  add column is_private boolean not null default false,
  add column followers_count integer not null default 0,
  add column following_count integer not null default 0,
  add column posts_count integer not null default 0,
  add constraint profiles_bio_length check (char_length(bio) <= 150),
  add constraint profiles_links_valid check (public.is_valid_profile_links(links));

comment on column public.profiles.is_private is
  'Private account: content and follower lists only for approved followers (can_view_profile).';
comment on column public.profiles.posts_count is 'Maintained by Phase 3 (posts) triggers.';

-- Counters are trigger-maintained; clients may edit only these columns.
grant update (bio, links, is_private) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Visibility helper used by every later phase's RLS (posts, stories, highlights, lists).
-- ---------------------------------------------------------------------------------------------
create function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid()
    or exists (select 1 from public.profiles p where p.id = target and not p.is_private)
    or exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = target
    );
$$;

-- ---------------------------------------------------------------------------------------------
-- follows: finish the Phase 1 stub
-- ---------------------------------------------------------------------------------------------
create index follows_follower_created_idx on public.follows (follower_id, created_at desc);

drop policy follows_select_authenticated on public.follows;
drop policy follows_insert_owner on public.follows;

-- A follow row is part of the follower's "following" list and the target's "followers" list;
-- it is visible when either list is visible to the viewer.
create policy follows_select_visible on public.follows
  for select to authenticated
  using (public.can_view_profile(follower_id) or public.can_view_profile(following_id));

-- Direct follows only for public accounts; private ones go through follow_requests.
create policy follows_insert_owner on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = following_id and not p.is_private)
  );

-- Remove follower (page 21/23): the followed account can delete the row.
create policy follows_delete_followed on public.follows
  for delete to authenticated
  using (following_id = (select auth.uid()));

create function public.follows_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
  end if;
  update public.profiles set followers_count = greatest(followers_count - 1, 0)
    where id = old.following_id;
  update public.profiles set following_count = greatest(following_count - 1, 0)
    where id = old.follower_id;
  -- Favorites must be accounts you follow.
  delete from public.favorites where owner_id = old.follower_id and favorite_id = old.following_id;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- follow_requests (private accounts)
-- ---------------------------------------------------------------------------------------------
create table public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);

create index follow_requests_target_idx on public.follow_requests (target_id, created_at desc);

alter table public.follow_requests enable row level security;

create policy follow_requests_select_party on public.follow_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));

create policy follow_requests_insert_owner on public.follow_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = target_id and p.is_private)
  );

-- Requester cancels; target declines.
create policy follow_requests_delete_party on public.follow_requests
  for delete to authenticated
  using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));

revoke update on public.follow_requests from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- close_friends / favorites / per-profile notification bell — owner-only lists
-- ---------------------------------------------------------------------------------------------
create table public.close_friends (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint close_friends_not_self check (owner_id <> friend_id)
);

alter table public.close_friends enable row level security;

create policy close_friends_select_owner on public.close_friends
  for select to authenticated using (owner_id = (select auth.uid()));
create policy close_friends_insert_owner on public.close_friends
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy close_friends_delete_owner on public.close_friends
  for delete to authenticated using (owner_id = (select auth.uid()));
revoke update on public.close_friends from anon, authenticated;

create table public.favorites (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  favorite_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, favorite_id),
  constraint favorites_not_self check (owner_id <> favorite_id)
);

alter table public.favorites enable row level security;

create policy favorites_select_owner on public.favorites
  for select to authenticated using (owner_id = (select auth.uid()));
create policy favorites_insert_owner on public.favorites
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy favorites_delete_owner on public.favorites
  for delete to authenticated using (owner_id = (select auth.uid()));
revoke update on public.favorites from anon, authenticated;

create function public.favorites_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.follows f where f.follower_id = new.owner_id and f.following_id = new.favorite_id
  ) then
    raise exception 'favorites_must_follow' using errcode = '22023';
  end if;
  if (select count(*) from public.favorites where owner_id = new.owner_id) >= 50 then
    raise exception 'favorites_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger favorites_before_insert
  before insert on public.favorites
  for each row execute function public.favorites_before_insert();

create trigger follows_after_change
  after insert or delete on public.follows
  for each row execute function public.follows_after_change();

-- Backfill counters for follows created by the Phase 1 stub.
update public.profiles p set
  followers_count = (select count(*) from public.follows f where f.following_id = p.id),
  following_count = (select count(*) from public.follows f where f.follower_id = p.id);

-- Bell on another profile (page 17). Stored now; Phase 8 delivers the notifications.
create table public.profile_notification_prefs (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  posts boolean not null default false,
  stories boolean not null default false,
  reels boolean not null default false,
  live boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, target_id),
  constraint profile_notification_prefs_not_self check (owner_id <> target_id)
);

alter table public.profile_notification_prefs enable row level security;

create policy profile_notification_prefs_select_owner on public.profile_notification_prefs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy profile_notification_prefs_insert_owner on public.profile_notification_prefs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy profile_notification_prefs_update_owner on public.profile_notification_prefs
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy profile_notification_prefs_delete_owner on public.profile_notification_prefs
  for delete to authenticated using (owner_id = (select auth.uid()));

create trigger profile_notification_prefs_set_updated_at
  before update on public.profile_notification_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- highlights (page 25: row now; highlight_items + editor arrive with stories in Phase 5)
-- ---------------------------------------------------------------------------------------------
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '',
  cover_path text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint highlights_title_length check (char_length(title) <= 32),
  constraint highlights_cover_owner check (
    cover_path is null or split_part(cover_path, '/', 1) = owner_id::text
  )
);

create index highlights_owner_idx on public.highlights (owner_id, position);

alter table public.highlights enable row level security;

create policy highlights_select_visible on public.highlights
  for select to authenticated using (public.can_view_profile(owner_id));
create policy highlights_insert_owner on public.highlights
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy highlights_update_owner on public.highlights
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy highlights_delete_owner on public.highlights
  for delete to authenticated using (owner_id = (select auth.uid()));

create trigger highlights_set_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Saved collections (pages 26/27). post_id gets its FK to posts in Phase 3; `saves` is Phase 4.
-- ---------------------------------------------------------------------------------------------
create table public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  cover_post_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_collections_name_length check (char_length(trim(name)) between 1 and 50)
);

create index saved_collections_owner_idx on public.saved_collections (owner_id, created_at desc);

alter table public.saved_collections enable row level security;

create policy saved_collections_select_owner on public.saved_collections
  for select to authenticated using (owner_id = (select auth.uid()));
create policy saved_collections_insert_owner on public.saved_collections
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy saved_collections_update_owner on public.saved_collections
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy saved_collections_delete_owner on public.saved_collections
  for delete to authenticated using (owner_id = (select auth.uid()));

create trigger saved_collections_set_updated_at
  before update on public.saved_collections
  for each row execute function public.set_updated_at();

create table public.saved_collection_items (
  collection_id uuid not null references public.saved_collections (id) on delete cascade,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

alter table public.saved_collection_items enable row level security;

create policy saved_collection_items_select_owner on public.saved_collection_items
  for select to authenticated
  using (exists (
    select 1 from public.saved_collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ));
create policy saved_collection_items_insert_owner on public.saved_collection_items
  for insert to authenticated
  with check (exists (
    select 1 from public.saved_collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ));
create policy saved_collection_items_delete_owner on public.saved_collection_items
  for delete to authenticated
  using (exists (
    select 1 from public.saved_collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ));
revoke update on public.saved_collection_items from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Going public approves every pending request (Instagram behavior).
-- ---------------------------------------------------------------------------------------------
create function public.profiles_after_privacy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    insert into public.follows (follower_id, following_id, created_at)
    select r.requester_id, r.target_id, r.created_at
    from public.follow_requests r
    where r.target_id = new.id
    on conflict do nothing;
    delete from public.follow_requests where target_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_after_privacy_change
  after update of is_private on public.profiles
  for each row execute function public.profiles_after_privacy_change();

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Follow (public) or request (private). Returns 'following' | 'requested'.
create function public.follow_user(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target_private boolean;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if target = me then
    raise exception 'cannot_follow_self' using errcode = '22023';
  end if;
  select is_private into target_private from public.profiles where id = target;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.follows where follower_id = me and following_id = target) then
    return 'following';
  end if;
  if target_private then
    insert into public.follow_requests (requester_id, target_id) values (me, target)
    on conflict do nothing;
    return 'requested';
  end if;
  insert into public.follows (follower_id, following_id) values (me, target)
  on conflict do nothing;
  return 'following';
end;
$$;

-- Unfollow and/or cancel a pending request.
create function public.unfollow_user(target uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.follows where follower_id = auth.uid() and following_id = target;
  delete from public.follow_requests where requester_id = auth.uid() and target_id = target;
$$;

-- The private account approves a request (UI: follow requests, page 72 — stub until Phase 8).
create function public.approve_follow_request(requester uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follow_requests where requester_id = requester and target_id = auth.uid();
  if not found then
    return false;
  end if;
  insert into public.follows (follower_id, following_id) values (requester, auth.uid())
  on conflict do nothing;
  return true;
end;
$$;

-- One profile + the viewer's relationship to it (pages 16–18). By username or id.
create function public.get_profile(p_username text default null, p_user_id uuid default null)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  bio text,
  links jsonb,
  is_private boolean,
  followers_count integer,
  following_count integer,
  posts_count integer,
  created_at timestamptz,
  is_self boolean,
  can_view boolean,
  i_follow boolean,
  follows_me boolean,
  requested boolean,
  is_close_friend boolean,
  is_favorite boolean,
  mutual_count integer,
  mutual_preview jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, p.bio, p.links, p.is_private,
    p.followers_count, p.following_count, p.posts_count, p.created_at,
    p.id = auth.uid(),
    public.can_view_profile(p.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.following_id = auth.uid()),
    exists (
      select 1 from public.follow_requests r where r.requester_id = auth.uid() and r.target_id = p.id
    ),
    exists (select 1 from public.close_friends c where c.owner_id = auth.uid() and c.friend_id = p.id),
    exists (select 1 from public.favorites v where v.owner_id = auth.uid() and v.favorite_id = p.id),
    (
      select count(*)::int
      from public.follows mine
      join public.follows theirs on theirs.follower_id = mine.following_id
      where mine.follower_id = auth.uid() and theirs.following_id = p.id and p.id <> auth.uid()
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('username', m.username, 'avatar_path', m.avatar_path))
      from (
        select mp.username, mp.avatar_path
        from public.follows mine
        join public.follows theirs on theirs.follower_id = mine.following_id
        join public.profiles mp on mp.id = mine.following_id
        where mine.follower_id = auth.uid() and theirs.following_id = p.id and p.id <> auth.uid()
        order by mp.followers_count desc
        limit 3
      ) m
    ), '[]'::jsonb)
  from public.profiles p
  where (p_username is not null and p.username = lower(trim(p_username)))
     or (p_user_id is not null and p.id = p_user_id)
  limit 1;
$$;

-- Followers / following / mutual lists (pages 21/22), with search and offset paging.
create function public.profile_connections(
  p_user_id uuid,
  p_kind text,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  is_self boolean,
  i_follow boolean,
  follows_me boolean,
  requested boolean,
  followed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ids as (
    select f.follower_id as uid, f.created_at
    from public.follows f
    where p_kind = 'followers' and f.following_id = p_user_id
    union all
    select f.following_id, f.created_at
    from public.follows f
    where p_kind = 'following' and f.follower_id = p_user_id
    union all
    select theirs.follower_id, theirs.created_at
    from public.follows theirs
    join public.follows mine
      on mine.following_id = theirs.follower_id and mine.follower_id = auth.uid()
    where p_kind = 'mutual' and theirs.following_id = p_user_id
  ),
  pattern as (
    select '%' || replace(replace(replace(lower(trim(coalesce(p_search, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q
  )
  select p.id, p.username, p.full_name, p.avatar_path, p.is_private,
    p.id = auth.uid(),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.following_id = auth.uid()),
    exists (
      select 1 from public.follow_requests r where r.requester_id = auth.uid() and r.target_id = p.id
    ),
    ids.created_at
  from ids
  join public.profiles p on p.id = ids.uid
  cross join pattern
  where (p_kind = 'mutual' or public.can_view_profile(p_user_id))
    and (p.username like pattern.q or lower(p.full_name) like pattern.q)
  order by ids.created_at desc, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

-- People for the Close Friends / Favorites pickers (pages 30/31): followers + following.
create function public.people_picker(p_search text default '', p_limit integer default 100)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  i_follow boolean,
  is_close_friend boolean,
  is_favorite boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with pattern as (
    select '%' || replace(replace(replace(lower(trim(coalesce(p_search, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q
  ),
  people as (
    select f.following_id as uid, f.created_at from public.follows f where f.follower_id = auth.uid()
    union
    select f.follower_id, f.created_at from public.follows f where f.following_id = auth.uid()
  )
  select p.id, p.username, p.full_name, p.avatar_path,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id),
    exists (select 1 from public.close_friends c where c.owner_id = auth.uid() and c.friend_id = p.id),
    exists (select 1 from public.favorites v where v.owner_id = auth.uid() and v.favorite_id = p.id)
  from (select uid, max(created_at) as created_at from people group by uid) x
  join public.profiles p on p.id = x.uid
  cross join pattern
  where p.username like pattern.q or lower(p.full_name) like pattern.q
  order by x.created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Page 11 suggestions: also skip pending requests, and report privacy (Follow vs Requested).
drop function public.suggested_accounts(int);

create function public.suggested_accounts(max_count int default 30)
returns table (
  id uuid, username text, full_name text, avatar_path text, is_private boolean, reason text
)
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
  )
  select p.id, p.username, p.full_name, p.avatar_path, p.is_private,
    case when p.id in (select id from contacts) then 'contact' else 'popular' end as reason
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    )
    and not exists (
      select 1 from public.follow_requests r where r.requester_id = auth.uid() and r.target_id = p.id
    )
  order by (p.id in (select id from contacts)) desc, p.followers_count desc, p.created_at desc
  limit least(greatest(max_count, 1), 100);
$$;

-- ---------------------------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.is_valid_profile_links(jsonb) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.follows_after_change() from public, anon, authenticated;
revoke execute on function public.favorites_before_insert() from public, anon, authenticated;
revoke execute on function public.profiles_after_privacy_change() from public, anon, authenticated;
revoke execute on function public.follow_user(uuid) from public, anon;
revoke execute on function public.unfollow_user(uuid) from public, anon;
revoke execute on function public.approve_follow_request(uuid) from public, anon;
revoke execute on function public.get_profile(text, uuid) from public, anon;
revoke execute on function public.profile_connections(uuid, text, text, integer, integer) from public, anon;
revoke execute on function public.people_picker(text, integer) from public, anon;
revoke execute on function public.suggested_accounts(int) from public, anon;

grant execute on function public.is_valid_profile_links(jsonb) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.approve_follow_request(uuid) to authenticated;
grant execute on function public.get_profile(text, uuid) to authenticated;
grant execute on function public.profile_connections(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.people_picker(text, integer) to authenticated;
grant execute on function public.suggested_accounts(int) to authenticated;
