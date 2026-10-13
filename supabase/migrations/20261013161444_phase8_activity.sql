-- Phase 8 — Notifications / Activity (pages 71–73)
-- * notifications: one row per event, written only by triggers / definer functions; retracting
--   the action (unlike, unfollow, delete comment…) removes the row. Grouping happens at read time.
-- * activity_state: when the user last opened Activity (New section, ♡ dot).
-- * activity_feed / activity_badge / follow_request_summary / notification_preview: reads.
-- * suggestion_dismissals + suggested_accounts v3: one ranked suggestions source (page 73).
-- No OS push (user decision 2026-10-13): in-app alerts via Realtime on `notifications`.

-- ---------------------------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  audio_id uuid references public.audio_tracks (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type in (
    'post_like', 'comment', 'comment_reply', 'comment_like', 'comment_mention',
    'post_mention', 'post_tag', 'follow', 'follow_accepted', 'collab_invite', 'collab_accepted',
    'repost', 'story_like', 'story_mention', 'remix', 'audio_use', 'countdown_ended', 'add_yours',
    'bell_post', 'bell_reel', 'bell_story'
  )),
  constraint notifications_not_self check (recipient_id <> actor_id),
  constraint notifications_once unique nulls not distinct
    (recipient_id, type, actor_id, post_id, comment_id, story_id, audio_id)
);

comment on table public.notifications is
  'Activity rows (page 71). Written by triggers only; recipients read / delete their own.';

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id) where post_id is not null;
create index notifications_comment_idx on public.notifications (comment_id) where comment_id is not null;
create index notifications_story_idx on public.notifications (story_id) where story_id is not null;
create index notifications_audio_idx on public.notifications (audio_id) where audio_id is not null;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));
revoke insert, update on public.notifications from anon, authenticated;

-- In-app alerts (♡ dot, bubble, banner) listen to inserts; requests feed the same badge.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.follow_requests;

-- When Activity was last opened.
create table public.activity_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.activity_state enable row level security;
create policy activity_state_select_own on public.activity_state
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.activity_state from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Writers (definer, called from triggers only)
-- ---------------------------------------------------------------------------------------------
create function public.notify(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_post uuid default null,
  p_comment uuid default null,
  p_story uuid default null,
  p_audio uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  insert into public.notifications
    (recipient_id, actor_id, type, post_id, comment_id, story_id, audio_id, data, created_at)
  values (p_recipient, p_actor, p_type, p_post, p_comment, p_story, p_audio, p_data, p_at)
  on conflict on constraint notifications_once do nothing;
end;
$$;

-- Author + accepted collaborators of a post (likes, comments and reposts reach all of them).
create function public.post_owners(p_post uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.author_id from public.posts p where p.id = p_post
  union
  select c.user_id from public.post_collaborators c
  where c.post_id = p_post and c.status = 'accepted';
$$;

-- likes
create function public.likes_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(o, new.user_id, 'post_like', new.post_id)
    from public.post_owners(new.post_id) o;
  else
    delete from public.notifications
    where type = 'post_like' and actor_id = old.user_id and post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_notify after insert or delete on public.likes
  for each row execute function public.likes_notify();

-- comment likes
create function public.comment_likes_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(c.author_id, new.user_id, 'comment_like', c.post_id, c.id)
    from public.comments c where c.id = new.comment_id;
  else
    delete from public.notifications
    where type = 'comment_like' and actor_id = old.user_id and comment_id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_notify after insert or delete on public.comment_likes
  for each row execute function public.comment_likes_notify();

-- comments: reply → parent writer; comment → post owners; @mentions → the rest.
-- Deleting a comment removes its rows through the comment_id FK.
create function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  if new.parent_id is not null then
    select author_id into v_parent_author from public.comments where id = new.parent_id;
    perform public.notify(v_parent_author, new.author_id, 'comment_reply', new.post_id, new.id);
  end if;
  perform public.notify(o, new.author_id, 'comment', new.post_id, new.id)
  from public.post_owners(new.post_id) o
  where o is distinct from v_parent_author;
  perform public.notify(p.id, new.author_id, 'comment_mention', new.post_id, new.id)
  from public.profiles p
  where p.username in (
      select lower(m[1]) from regexp_matches(new.body, '@([A-Za-z0-9._]{1,30})', 'g') m
    )
    and not exists (
      select 1 from public.notifications n where n.recipient_id = p.id and n.comment_id = new.id
    );
  return null;
end;
$$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.comments_notify();

-- follows (unfollow / remove follower retracts)
create function public.follows_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.following_id, new.follower_id, 'follow');
  else
    delete from public.notifications
    where type = 'follow' and actor_id = old.follower_id and recipient_id = old.following_id;
    delete from public.notifications
    where type = 'follow_accepted' and actor_id = old.following_id and recipient_id = old.follower_id;
  end if;
  return null;
end;
$$;

create trigger follows_notify after insert or delete on public.follows
  for each row execute function public.follows_notify();

-- Approving a request also tells the requester (page 72).
create or replace function public.approve_follow_request(requester uuid)
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
  perform public.notify(requester, auth.uid(), 'follow_accepted');
  return true;
end;
$$;

-- reposts
create function public.reposts_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(o, new.user_id, 'repost', new.post_id)
    from public.post_owners(new.post_id) o;
  else
    delete from public.notifications
    where type = 'repost' and actor_id = old.user_id and post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger reposts_notify after insert or delete on public.reposts
  for each row execute function public.reposts_notify();

-- story likes
create function public.story_likes_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(s.author_id, new.user_id, 'story_like', null, null, s.id)
    from public.stories s where s.id = new.story_id;
  else
    delete from public.notifications
    where type = 'story_like' and actor_id = old.user_id and story_id = old.story_id;
  end if;
  return null;
end;
$$;

create trigger story_likes_notify after insert or delete on public.story_likes
  for each row execute function public.story_likes_notify();

-- Caption @mentions (rows exist only for published posts; caption edits add / remove them).
create function public.post_mentions_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, p.author_id, 'post_mention', p.id)
    from public.posts p where p.id = new.post_id and p.status = 'published';
  else
    delete from public.notifications
    where type = 'post_mention' and recipient_id = old.user_id and post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_mentions_notify after insert or delete on public.post_mentions
  for each row execute function public.post_mentions_notify();

-- Tags added after publishing (Edit info); tags on new posts are sent by posts_notify_publish.
create function public.post_tags_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.tagged_user_id, p.author_id, 'post_tag', p.id)
    from public.posts p where p.id = new.post_id and p.status = 'published';
  elsif not exists (
    select 1 from public.post_tags t
    where t.post_id = old.post_id and t.tagged_user_id = old.tagged_user_id
  ) then
    delete from public.notifications
    where type = 'post_tag' and recipient_id = old.tagged_user_id and post_id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_tags_notify after insert or delete on public.post_tags
  for each row execute function public.post_tags_notify();

-- Collaboration invites: sent when the post is live; accepting tells the author; declining
-- (row deleted) or removal retracts the invite.
create function public.post_collaborators_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, p.author_id, 'collab_invite', p.id)
    from public.posts p where p.id = new.post_id and p.status = 'published';
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'accepted' then
      perform public.notify(p.author_id, new.user_id, 'collab_accepted', p.id)
      from public.posts p where p.id = new.post_id;
    end if;
  else
    delete from public.notifications
    where type in ('collab_invite', 'collab_accepted') and post_id = old.post_id
      and (recipient_id = old.user_id or actor_id = old.user_id);
  end if;
  return null;
end;
$$;

create trigger post_collaborators_notify after insert or update or delete on public.post_collaborators
  for each row execute function public.post_collaborators_notify();

-- A post / reel goes live: tags, collab invites, remix credit, use of someone's original audio,
-- and bell subscribers (page 17). Caption mentions come from post_mentions_notify.
create function public.posts_notify_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return null;
  end if;

  perform public.notify(t.tagged_user_id, new.author_id, 'post_tag', new.id)
  from (select distinct tagged_user_id from public.post_tags where post_id = new.id) t;

  perform public.notify(c.user_id, new.author_id, 'collab_invite', new.id)
  from public.post_collaborators c where c.post_id = new.id and c.status = 'pending';

  if new.remix_of is not null then
    perform public.notify(o.author_id, new.author_id, 'remix', new.id)
    from public.posts o where o.id = new.remix_of;
  end if;

  if new.audio_track_id is not null then
    perform public.notify(a.owner_id, new.author_id, 'audio_use', new.id, null, null, a.id)
    from public.audio_tracks a
    where a.id = new.audio_track_id and a.source = 'original'
      and a.origin_post_id is distinct from new.id;
  end if;

  perform public.notify(
    n.owner_id, new.author_id, case when new.kind = 'reel' then 'bell_reel' else 'bell_post' end,
    new.id
  )
  from public.profile_notification_prefs n
  where n.target_id = new.author_id
    and case when new.kind = 'reel' then n.reels else n.posts end;
  return null;
end;
$$;

create trigger posts_notify_publish after insert or update of status on public.posts
  for each row execute function public.posts_notify_publish();

-- A story goes live: mentions, Add yours participation (to the chain's starter), bell.
create function public.stories_notify_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or old.status = 'published' then
    return null;
  end if;

  perform public.notify(m.user_id, new.author_id, 'story_mention', null, null, new.id)
  from public.story_mentions m where m.story_id = new.id;

  perform public.notify(r.author_id, new.author_id, 'add_yours', null, null, new.id, null,
    jsonb_build_object('prompt', r.data ->> 'prompt'))
  from public.story_stickers k
  join public.story_stickers r on r.id = k.chain_id and r.id <> k.id
  where k.story_id = new.id and k.type = 'add_yours';

  perform public.notify(n.owner_id, new.author_id, 'bell_story', null, null, new.id)
  from public.profile_notification_prefs n
  where n.target_id = new.author_id and n.stories;
  return null;
end;
$$;

create trigger stories_notify_publish after update of status on public.stories
  for each row execute function public.stories_notify_publish();

-- Countdown reminders become notifications once the countdown ends. Called by activity_badge
-- (no server cron yet), dated at the end time.
create function public.sync_countdown_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, story_id, data, created_at)
  select r.user_id, k.author_id, 'countdown_ended', k.story_id,
    jsonb_build_object('title', k.data ->> 'title'), (k.data ->> 'ends_at')::timestamptz
  from public.story_sticker_responses r
  join public.story_stickers k on k.id = r.sticker_id and k.type = 'countdown'
  where r.user_id = auth.uid() and r.type = 'countdown'
    and (k.data ->> 'ends_at')::timestamptz <= now()
    and (k.data ->> 'ends_at')::timestamptz > now() - interval '30 days'
    and k.author_id <> r.user_id
  on conflict on constraint notifications_once do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------
-- My notifications whose target I can still see (RLS on posts / comments / stories decides).
-- Story mentions and ended countdowns stay after the story expires (thumbnail disappears).
create function public.visible_notifications(p_before timestamptz default null)
returns setof public.notifications
language sql
stable
security invoker
set search_path = ''
as $$
  select n.*
  from public.notifications n
  where n.recipient_id = auth.uid()
    and (p_before is null or n.created_at <= p_before)
    and (n.post_id is null or exists (select 1 from public.posts p where p.id = n.post_id))
    and (n.comment_id is null or exists (select 1 from public.comments c where c.id = n.comment_id))
    and (
      n.story_id is null or n.type in ('story_mention', 'countdown_ended')
      or exists (select 1 from public.stories s where s.id = n.story_id)
    );
$$;

-- Opening Activity: returns the previous "seen" time (rows after it form the New section).
create function public.mark_activity_seen()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select seen_at into v_prev from public.activity_state where user_id = auth.uid();
  insert into public.activity_state (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
  return coalesce(v_prev, '-infinity'::timestamptz);
end;
$$;

-- ♡ dot + bubble on Home: unseen counts by category (also materializes ended countdowns).
create function public.activity_badge()
returns table (
  unseen integer,
  likes integer,
  comments integer,
  follows integer,
  requests integer,
  pending_requests integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_seen timestamptz;
begin
  perform public.sync_countdown_notifications();
  select s.seen_at into v_seen from public.activity_state s where s.user_id = auth.uid();
  v_seen := coalesce(v_seen, '-infinity'::timestamptz);
  return query
  with n as (select * from public.visible_notifications(null) v where v.created_at > v_seen),
  r as (select * from public.follow_requests f where f.target_id = auth.uid())
  select
    ((select count(*) from n) + (select count(*) from r where r.created_at > v_seen))::integer,
    (select count(*) from n where n.type in ('post_like', 'comment_like', 'story_like'))::integer,
    (select count(*) from n where n.type in (
      'comment', 'comment_reply', 'comment_mention', 'post_mention', 'story_mention', 'post_tag'
    ))::integer,
    (select count(*) from n where n.type in ('follow', 'follow_accepted'))::integer,
    (select count(*) from r where r.created_at > v_seen)::integer,
    (select count(*) from r)::integer;
end;
$$;

-- Page 71 list. Likes on the same post / comment / story, uses of the same audio and new
-- followers collapse into one row per section. Sections: new (after p_seen), today,
-- yesterday (in p_tz), week (7 days), month (30 days), older. p_before = snapshot for paging.
create function public.activity_feed(
  p_seen timestamptz,
  p_before timestamptz,
  p_tz text default 'UTC',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  group_key text,
  section text,
  type text,
  latest_at timestamptz,
  ids uuid[],
  actor_count integer,
  actors jsonb,
  data jsonb,
  post jsonb,
  comment jsonb,
  story jsonb,
  audio jsonb,
  actor_follow jsonb,
  collab_status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tz as (
    select coalesce((select t.name from pg_catalog.pg_timezone_names t where t.name = p_tz), 'UTC') as name
  ),
  base as (
    select v.*,
      case
        when v.created_at > coalesce(p_seen, '-infinity'::timestamptz) then 'new'
        when (v.created_at at time zone tz.name)::date = (p_before at time zone tz.name)::date then 'today'
        when (v.created_at at time zone tz.name)::date = (p_before at time zone tz.name)::date - 1 then 'yesterday'
        when v.created_at > p_before - interval '7 days' then 'week'
        when v.created_at > p_before - interval '30 days' then 'month'
        else 'older'
      end as section
    from public.visible_notifications(p_before) v, tz
  ),
  keyed as (
    select b.*,
      case b.type
        when 'post_like' then 'post_like:' || b.post_id
        when 'comment_like' then 'comment_like:' || b.comment_id
        when 'story_like' then 'story_like:' || b.story_id
        when 'audio_use' then 'audio_use:' || b.audio_id
        when 'follow' then 'follow'
        else b.id::text
      end || '@' || b.section as gkey
    from base b
  ),
  groups as (
    select k.gkey,
      max(k.created_at) as latest_at,
      array_agg(k.id order by k.created_at desc) as ids,
      count(distinct k.actor_id)::integer as actor_count
    from keyed k
    group by k.gkey
    order by max(k.created_at) desc, k.gkey
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 100)
  )
  select g.gkey, h.section, h.type, g.latest_at, g.ids, g.actor_count,
    (
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'username', a.username, 'avatar_path', a.avatar_path
      ) order by x.at desc)
      from (
        select k.actor_id, max(k.created_at) as at from keyed k
        where k.gkey = g.gkey group by k.actor_id order by at desc limit 2
      ) x
      join public.profiles a on a.id = x.actor_id
    ),
    h.data,
    (select to_jsonb(t) from public.post_tile(h.post_id) t where h.post_id is not null),
    (
      select jsonb_build_object(
        'id', c.id, 'body', c.body, 'parent_id', c.parent_id, 'author_id', c.author_id,
        'liked', exists (
          select 1 from public.comment_likes cl where cl.comment_id = c.id and cl.user_id = auth.uid()
        )
      )
      from public.comments c where c.id = h.comment_id
    ),
    case when h.story_id is not null then (
      select coalesce(
        (select jsonb_build_object(
          'id', s.id, 'visible', true, 'kind', s.kind, 'author_id', s.author_id,
          'thumb_path', coalesce(s.thumb_path, case when s.kind = 'photo' then s.media_path end)
        ) from public.stories s where s.id = h.story_id),
        jsonb_build_object('id', h.story_id, 'visible', false)
      )
    ) end,
    (
      select jsonb_build_object('id', au.id, 'title', au.title)
      from public.audio_tracks au where au.id = h.audio_id
    ),
    case when h.type in ('follow', 'follow_accepted') then (
      select jsonb_build_object(
        'is_private', ap.is_private,
        'i_follow', exists (
          select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = ap.id
        ),
        'requested', exists (
          select 1 from public.follow_requests r where r.requester_id = auth.uid() and r.target_id = ap.id
        )
      )
      from public.profiles ap where ap.id = h.actor_id
    ) end,
    case when h.type = 'collab_invite' then (
      select pc.status from public.post_collaborators pc
      where pc.post_id = h.post_id and pc.user_id = auth.uid()
    ) end
  from groups g
  join keyed h on h.id = g.ids[1]
  order by g.latest_at desc, g.gkey;
$$;

-- One notification for the in-app banner (null when it isn't visible to me any more).
create function public.notification_preview(p_id uuid)
returns table (
  id uuid,
  type text,
  actor_username text,
  actor_avatar_path text,
  post_id uuid,
  post_kind text,
  comment_body text,
  story_id uuid,
  data jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.type, a.username, a.avatar_path, n.post_id,
    (select p.kind from public.posts p where p.id = n.post_id),
    (select c.body from public.comments c where c.id = n.comment_id),
    n.story_id, n.data
  from public.visible_notifications(null) n
  join public.profiles a on a.id = n.actor_id
  where n.id = p_id;
$$;

-- Activity's "Follow requests" row: count + the two newest requesters.
create function public.follow_request_summary()
returns table (total integer, latest jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*)::integer from public.follow_requests r where r.target_id = auth.uid()),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'username', p.username, 'avatar_path', p.avatar_path
      ) order by x.created_at desc)
      from (
        select r.requester_id, r.created_at from public.follow_requests r
        where r.target_id = auth.uid() order by r.created_at desc limit 2
      ) x
      join public.profiles p on p.id = x.requester_id
    ), '[]'::jsonb);
$$;

-- Page 72 list with search; i_follow / requested drive "Follow back" after confirming.
create function public.my_follow_requests(
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  i_follow boolean,
  requested boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, p.is_private,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id),
    exists (select 1 from public.follow_requests q where q.requester_id = auth.uid() and q.target_id = p.id),
    r.created_at
  from public.follow_requests r
  join public.profiles p on p.id = r.requester_id
  where r.target_id = auth.uid()
    and (
      coalesce(trim(p_search), '') = ''
      or p.username ilike '%' || trim(p_search) || '%'
      or extensions.unaccent(p.full_name) ilike '%' || extensions.unaccent(trim(p_search)) || '%'
    )
  order by r.created_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;



-- ---------------------------------------------------------------------------------------------
-- Suggestions (page 73)
-- ---------------------------------------------------------------------------------------------
create table public.suggestion_dismissals (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  constraint suggestion_dismissals_not_self check (user_id <> target_id)
);

alter table public.suggestion_dismissals enable row level security;
create policy suggestion_dismissals_select_own on public.suggestion_dismissals
  for select to authenticated using (user_id = (select auth.uid()));
create policy suggestion_dismissals_insert_own on public.suggestion_dismissals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy suggestion_dismissals_delete_own on public.suggestion_dismissals
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.suggestion_dismissals from anon, authenticated;

-- One ranked source for Discover people, the Home / profile / Explore strips and onboarding:
-- follows you > contacts > friends of friends > people liking the same posts > new > popular.
-- Dismissed accounts come back after 180 days, like Instagram.
drop function public.suggested_accounts(int);

create function public.suggested_accounts(max_count integer default 30, p_offset integer default 0)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  reason text,
  follows_me boolean,
  mutual_count integer,
  mutual_username text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  contacts as (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex') in (
      select c.hash from public.contact_hashes c where c.owner_id = (select id from me)
    )
  ),
  mutual as (
    select f2.following_id as id, count(*)::integer as n,
      (array_agg(via.username order by via.followers_count desc, via.username))[1] as via
    from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id
    join public.profiles via on via.id = f1.following_id
    where f1.follower_id = (select id from me)
    group by f2.following_id
  ),
  co_likers as (
    select l2.user_id as id, count(*)::integer as n
    from public.likes l1
    join public.likes l2 on l2.post_id = l1.post_id and l2.user_id <> l1.user_id
    where l1.user_id = (select id from me) and l1.created_at > now() - interval '90 days'
    group by l2.user_id
  ),
  ranked as (
    select p.*,
      exists (
        select 1 from public.follows f where f.follower_id = p.id and f.following_id = (select id from me)
      ) as follows_me,
      p.id in (select id from contacts) as is_contact,
      coalesce(m.n, 0) as mutual_n,
      m.via,
      coalesce(cl.n, 0) as co_n,
      p.created_at > now() - interval '30 days' as is_new
    from public.profiles p
    left join mutual m on m.id = p.id
    left join co_likers cl on cl.id = p.id
    where (select id from me) is not null
      and p.id <> (select id from me)
      and not exists (
        select 1 from public.follows f where f.follower_id = (select id from me) and f.following_id = p.id
      )
      and not exists (
        select 1 from public.follow_requests r where r.requester_id = (select id from me) and r.target_id = p.id
      )
      and not exists (
        select 1 from public.suggestion_dismissals d
        where d.user_id = (select id from me) and d.target_id = p.id
          and d.created_at > now() - interval '180 days'
      )
  )
  select r.id, r.username, r.full_name, r.avatar_path, r.is_private,
    case
      when r.follows_me then 'follows_you'
      when r.is_contact then 'contact'
      when r.mutual_n > 0 then 'mutual'
      when r.is_new then 'new'
      else 'popular'
    end,
    r.follows_me, r.mutual_n, r.via
  from ranked r
  order by
    (r.follows_me::integer * 100 + r.is_contact::integer * 80 + least(r.mutual_n, 20) * 10
      + least(r.co_n, 10) * 3 + r.is_new::integer * 5 + ln(1 + r.followers_count)) desc,
    r.created_at desc, r.id
  offset greatest(p_offset, 0)
  limit least(greatest(max_count, 1), 100);
$$;

-- ---------------------------------------------------------------------------------------------
-- Reserved route names (+ activity, discover-people)
-- ---------------------------------------------------------------------------------------------
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
      'about', 'accounts', 'activity', 'admin', 'administrator', 'api', 'archive', 'audio',
      'compose', 'create', 'dev', 'direct', 'discover-people', 'explore', 'explore-feed',
      'favorites', 'feed', 'help', 'highlights', 'humans', 'instagram', 'legal', 'login', 'logout',
      'null', 'p', 'profile', 'qr', 'recent-searches', 'reel', 'reel-create', 'reels', 'report',
      'root', 'saved', 'search', 'settings', 'signup', 'stories', 'story', 'support', 'tags',
      'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.notify(uuid, uuid, text, uuid, uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.post_owners(uuid) from public, anon, authenticated;
revoke execute on function public.likes_notify() from public, anon, authenticated;
revoke execute on function public.comment_likes_notify() from public, anon, authenticated;
revoke execute on function public.comments_notify() from public, anon, authenticated;
revoke execute on function public.follows_notify() from public, anon, authenticated;
revoke execute on function public.reposts_notify() from public, anon, authenticated;
revoke execute on function public.story_likes_notify() from public, anon, authenticated;
revoke execute on function public.post_mentions_notify() from public, anon, authenticated;
revoke execute on function public.post_tags_notify() from public, anon, authenticated;
revoke execute on function public.post_collaborators_notify() from public, anon, authenticated;
revoke execute on function public.posts_notify_publish() from public, anon, authenticated;
revoke execute on function public.stories_notify_publish() from public, anon, authenticated;
revoke execute on function public.sync_countdown_notifications() from public, anon;
revoke execute on function public.visible_notifications(timestamptz) from public, anon;
revoke execute on function public.mark_activity_seen() from public, anon;
revoke execute on function public.activity_badge() from public, anon;
revoke execute on function public.activity_feed(timestamptz, timestamptz, text, integer, integer) from public, anon;
revoke execute on function public.notification_preview(uuid) from public, anon;
revoke execute on function public.follow_request_summary() from public, anon;
revoke execute on function public.my_follow_requests(text, integer, integer) from public, anon;
revoke execute on function public.suggested_accounts(integer, integer) from public, anon;
revoke execute on function public.approve_follow_request(uuid) from public, anon;

grant execute on function public.sync_countdown_notifications() to authenticated;
grant execute on function public.visible_notifications(timestamptz) to authenticated;
grant execute on function public.mark_activity_seen() to authenticated;
grant execute on function public.activity_badge() to authenticated;
grant execute on function public.activity_feed(timestamptz, timestamptz, text, integer, integer) to authenticated;
grant execute on function public.notification_preview(uuid) to authenticated;
grant execute on function public.follow_request_summary() to authenticated;
grant execute on function public.my_follow_requests(text, integer, integer) to authenticated;
grant execute on function public.suggested_accounts(integer, integer) to authenticated;
grant execute on function public.approve_follow_request(uuid) to authenticated;
