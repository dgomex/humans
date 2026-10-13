-- Phase 7 — Search & Explore (pages 65–68, 70; 69 Place page dropped). Decisions:
-- docs/DECISIONS.md 2026-10-12.
--
-- * Finishes the Phase 3 hashtags stub: hashtag page header + Top / Recent / Reels grids.
-- * Explore grid: ranked public posts + reels from accounts you don't follow (followed ones
--   mixed in at a lower weight), personalised by the hashtags / authors you engage with and by
--   who the people you follow follow. Snapshot-stable paging with a per-refresh shuffle.
-- * Explore post scroller: similar_posts(seed) ranks posts similar to the tapped one first
--   (author, hashtags, audio, co-likes), then the rest of Explore.
-- * Search: accounts, hashtags, audio and caption keyword search (full-text, 'simple' config).
-- * Recent searches: search_history (owner-only), written by record_search().
-- All read RPCs are security invoker, so posts / likes / tracks RLS (can_view_post) applies.

-- ---------------------------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------------------------

-- Grid tile for one post (cover = reel cover or first slide / video poster).
create function public.post_tile(p_id uuid)
returns table (
  id uuid,
  author_id uuid,
  kind text,
  cover_path text,
  cover_type text,
  media_count integer,
  play_count integer,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.author_id, p.kind,
    coalesce(p.cover_path, m.thumb_path, m.path),
    case when p.cover_path is not null then 'image' else m.type end,
    (select count(*)::integer from public.post_media x where x.post_id = p.id),
    case when p.hide_like_counts and p.author_id <> auth.uid() then null else p.play_count end,
    p.cover_offset
  from public.posts p
  left join lateral (
    select pm.path, pm.thumb_path, pm.type from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where p.id = p_id;
$$;

-- Engagement over time decay, shared by the Explore / hashtag / search rankings.
create function public.post_base_score(
  p_likes integer,
  p_comments integer,
  p_reposts integer,
  p_plays integer,
  p_published_at timestamptz,
  p_now timestamptz
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select (
    ln(2 + coalesce(p_likes, 0) + 2 * coalesce(p_comments, 0) + 3 * coalesce(p_reposts, 0)
       + coalesce(p_plays, 0) / 20.0)
    / power(1 + greatest(extract(epoch from (p_now - p_published_at)), 0) / 3600.0 / 72.0, 0.8)
  )::double precision;
$$;

-- Caption keyword search.
create index posts_caption_fts_idx on public.posts using gin (to_tsvector('simple', caption));

-- ---------------------------------------------------------------------------------------------
-- Explore grid (page 65)
-- ---------------------------------------------------------------------------------------------
create function public.explore_grid(
  p_snapshot timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  kind text,
  cover_path text,
  cover_type text,
  media_count integer,
  play_count integer,
  cover_offset real,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  -- What I engaged with lately: likes, saves, comments, reel plays.
  engaged as (
    select l.post_id from public.likes l, me
    where l.user_id = me.id and l.created_at > p_snapshot - interval '90 days'
    union all
    select s.post_id from public.saves s, me where s.user_id = me.id
    union all
    select c.post_id from public.comments c, me
    where c.author_id = me.id and c.created_at > p_snapshot - interval '90 days'
    union all
    select rp.post_id from public.reel_plays rp, me where rp.user_id = me.id
  ),
  my_tags as (
    select ph.hashtag_id, count(*)::double precision as w
    from engaged e join public.post_hashtags ph on ph.post_id = e.post_id
    group by ph.hashtag_id
  ),
  my_authors as (
    select p.author_id, count(*)::double precision as w
    from engaged e join public.posts p on p.id = e.post_id
    group by p.author_id
  ),
  -- Accounts followed by the people I follow.
  friend_follows as (
    select f2.following_id as author_id, count(*)::double precision as w
    from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id, me
    where f1.follower_id = me.id
    group by f2.following_id
  ),
  cand as (
    select p.id, p.author_id, p.kind,
      public.post_base_score(p.like_count, p.comment_count, p.repost_count, p.play_count,
        p.published_at, p_snapshot) as base,
      exists (
        select 1 from public.follows f, me where f.follower_id = me.id and f.following_id = p.author_id
      ) as followed
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.status = 'published'
      and p.archived_at is null
      and p.audience = 'everyone'
      and not a.is_private
      and p.published_at <= p_snapshot
      and p.author_id <> (select id from me)
      and not exists (
        select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = p.id
      )
  ),
  ranked as (
    select c.id,
      (
        c.base
        * (1 + 0.3 * least(coalesce((
            select sum(t.w) from public.post_hashtags ph join my_tags t on t.hashtag_id = ph.hashtag_id
            where ph.post_id = c.id
          ), 0), 5))
        * (1 + 0.2 * least(coalesce((select w from my_authors ma where ma.author_id = c.author_id), 0), 5))
        * (1 + 0.15 * least(coalesce((select w from friend_follows ff where ff.author_id = c.author_id), 0), 5))
        * case when c.followed then 0.5 else 1 end
        * case when c.kind = 'reel' then 1.1 else 1 end
        * case when exists (
            select 1 from public.post_seen s, me
            where s.user_id = me.id and s.post_id = c.id and s.seen_at < p_snapshot
          ) or exists (
            select 1 from public.reel_plays rp, me
            where rp.user_id = me.id and rp.post_id = c.id and rp.last_played_at < p_snapshot
          ) then 0.3 else 1 end
        * case when exists (
            select 1 from public.post_hides h join public.posts hp on hp.id = h.post_id, me
            where h.user_id = me.id and h.reason = 'not_interested' and hp.author_id = c.author_id
          ) then 0.2 else 1 end
        -- A different shuffle per refresh (snapshot), stable while paging.
        * (0.85 + 0.3 * abs(hashtext(c.id::text || p_snapshot::text)) / 2147483647.0)
      )::double precision as score
    from cand c
  )
  select t.id, t.author_id, t.kind, t.cover_path, t.cover_type, t.media_count, t.play_count,
    t.cover_offset, r.score
  from ranked r
  cross join lateral public.post_tile(r.id) t
  order by r.score desc, r.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------------------------
-- Explore post scroller (page 70): similar posts first, then the rest of Explore
-- ---------------------------------------------------------------------------------------------
create function public.similar_posts(
  p_post uuid,
  p_snapshot timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 10
)
returns table (post_id uuid, similarity double precision, score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  seed as (
    select p.id, p.author_id, p.audio_track_id from public.posts p where p.id = p_post
  ),
  seed_tags as (
    select ph.hashtag_id from public.post_hashtags ph where ph.post_id = p_post
  ),
  seed_likers as (
    select l.user_id from public.likes l, me where l.post_id = p_post and l.user_id <> me.id
  ),
  cand as (
    select p.id, p.author_id, p.audio_track_id,
      public.post_base_score(p.like_count, p.comment_count, p.repost_count, p.play_count,
        p.published_at, p_snapshot) as base
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.status = 'published'
      and p.archived_at is null
      and p.audience = 'everyone'
      and p.id <> p_post
      and p.published_at <= p_snapshot
      and p.author_id <> (select id from me)
      -- Public accounts, or private ones you follow (RLS hides the rest anyway).
      and (not a.is_private or exists (
        select 1 from public.follows f, me where f.follower_id = me.id and f.following_id = p.author_id
      ))
      and not exists (
        select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = p.id
      )
  ),
  scored as (
    select c.id, c.base,
      (
        3 * (c.author_id = s.author_id)::integer
        + 2 * coalesce(c.audio_track_id = s.audio_track_id, false)::integer
        + 1.5 * (select count(*) from public.post_hashtags ph
                 where ph.post_id = c.id and ph.hashtag_id in (select hashtag_id from seed_tags))
        + 0.5 * least((select count(*) from public.likes l
                       where l.post_id = c.id and l.user_id in (select user_id from seed_likers)), 6)
      )::double precision as similarity
    from cand c, seed s
  )
  select x.id, x.similarity,
    (
      (1 + x.similarity) * x.base
      * case when exists (
          select 1 from public.post_seen ps, me
          where ps.user_id = me.id and ps.post_id = x.id and ps.seen_at < p_snapshot
        ) then 0.3 else 1 end
      * case when exists (
          select 1 from public.post_hides h join public.posts hp on hp.id = h.post_id, me
          where h.user_id = me.id and h.reason = 'not_interested' and hp.author_id = (
            select author_id from public.posts where id = x.id
          )
        ) then 0.2 else 1 end
    )::double precision as score
  from scored x
  order by (x.similarity > 0) desc, score desc, x.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 30);
$$;

-- ---------------------------------------------------------------------------------------------
-- Hashtag page (page 68)
-- ---------------------------------------------------------------------------------------------
create function public.normalize_hashtag(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '^#+', ''));
$$;

-- Header: count + cover (the top visible post's cover). No row when the tag was never used.
create function public.hashtag_page(p_name text)
returns table (id uuid, name text, post_count integer, cover_path text, cover_post_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.name, h.post_count, t.cover_path, t.id
  from public.hashtags h
  left join lateral (
    select ph.post_id from public.post_hashtags ph
    join public.posts p on p.id = ph.post_id
    where ph.hashtag_id = h.id and p.status = 'published' and p.archived_at is null
    order by public.post_base_score(p.like_count, p.comment_count, p.repost_count, p.play_count,
      p.published_at, now()) desc, p.id
    limit 1
  ) top on true
  left join lateral public.post_tile(top.post_id) t on true
  where h.name = public.normalize_hashtag(p_name);
$$;

create function public.hashtag_posts(
  p_name text,
  p_tab text default 'top',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  kind text,
  cover_path text,
  cover_type text,
  media_count integer,
  play_count integer,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.author_id, t.kind, t.cover_path, t.cover_type, t.media_count, t.play_count,
    t.cover_offset
  from public.hashtags h
  join public.post_hashtags ph on ph.hashtag_id = h.id
  join public.posts p on p.id = ph.post_id
  cross join lateral public.post_tile(p.id) t
  where h.name = public.normalize_hashtag(p_name)
    and p.status = 'published'
    and p.archived_at is null
    and (p_tab <> 'reels' or p.kind = 'reel')
    and not exists (
      select 1 from public.post_hides x where x.user_id = auth.uid() and x.post_id = p.id
    )
  order by
    case when p_tab = 'recent' then extract(epoch from p.published_at) end desc nulls last,
    case when p_tab <> 'recent' then public.post_base_score(p.like_count, p.comment_count,
      p.repost_count, p.play_count, p.published_at, now()) end desc nulls last,
    p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------------------------
-- Search (page 66)
-- ---------------------------------------------------------------------------------------------
create function public.search_accounts(
  p_query text,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  i_follow boolean,
  requested boolean,
  followed_by text,
  mutual_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select lower(regexp_replace(trim(coalesce(p_query, '')), '^@+', '')) as raw,
      extensions.unaccent(lower(trim(coalesce(p_query, '')))) as plain
  ),
  matched as (
    select p.*,
      exists (
        select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
      ) as i_follow,
      exists (
        select 1 from public.follow_requests r
        where r.requester_id = auth.uid() and r.target_id = p.id
      ) as requested,
      (
        select count(*)::integer from public.follows mine
        join public.follows theirs on theirs.follower_id = mine.following_id
        where mine.follower_id = auth.uid() and theirs.following_id = p.id
      ) as mutual_count
    from public.profiles p, q
    where q.raw <> ''
      and (
        p.username like q.raw || '%'
        or p.username like '%' || q.raw || '%'
        or extensions.unaccent(lower(p.full_name)) like '%' || q.plain || '%'
      )
  )
  select m.id, m.username, m.full_name, m.avatar_path, m.is_private, m.i_follow, m.requested,
    (
      select fp.username from public.follows mine
      join public.follows theirs on theirs.follower_id = mine.following_id
      join public.profiles fp on fp.id = mine.following_id
      where mine.follower_id = auth.uid() and theirs.following_id = m.id
      order by fp.followers_count desc, fp.username
      limit 1
    ),
    m.mutual_count
  from matched m, q
  order by
    (m.username = q.raw) desc,
    m.i_follow desc,
    least(m.mutual_count, 10) desc,
    (m.username like q.raw || '%') desc,
    m.followers_count desc,
    m.username
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.search_hashtags(
  p_query text,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (id uuid, name text, post_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.name, h.post_count
  from public.hashtags h
  where public.normalize_hashtag(p_query) <> ''
    and h.name like replace(replace(public.normalize_hashtag(p_query), '%', ''), '_', '\_') || '%'
    and h.post_count > 0
  order by (h.name = public.normalize_hashtag(p_query)) desc, h.post_count desc, h.name
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.search_audio(
  p_query text,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  artist text,
  source text,
  cover_color text,
  duration_ms integer,
  audio_path text,
  owner_username text,
  owner_avatar_path text,
  reel_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select extensions.unaccent(lower(trim(coalesce(p_query, '')))) as plain),
  matched as (
    -- RLS: catalog tracks, your own, or original audio whose reel you can see.
    select t.*, o.username as owner_username, o.avatar_path as owner_avatar_path,
      (
        select count(*)::integer from public.posts p
        where p.audio_track_id = t.id and p.kind = 'reel' and p.status = 'published'
          and p.archived_at is null
      ) as reel_count
    from public.audio_tracks t
    left join public.profiles o on o.id = t.owner_id, q
    where q.plain <> ''
      and (
        extensions.unaccent(lower(t.title)) like '%' || q.plain || '%'
        or extensions.unaccent(lower(t.artist)) like '%' || q.plain || '%'
        or o.username like q.plain || '%'
      )
  )
  select m.id, m.title, m.artist, m.source, m.cover_color, m.duration_ms, m.audio_path,
    m.owner_username, m.owner_avatar_path, m.reel_count
  from matched m
  order by m.reel_count desc, m.title, m.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

-- Caption keyword search (For you = posts + reels, or reels only). Matches caption words,
-- hashtags and the author's username.
create function public.search_posts(
  p_query text,
  p_kind text default 'top',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  kind text,
  cover_path text,
  cover_type text,
  media_count integer,
  play_count integer,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('simple', trim(coalesce(p_query, ''))) as ts,
      public.normalize_hashtag(regexp_replace(trim(coalesce(p_query, '')), '\s+', '', 'g')) as tag,
      lower(regexp_replace(trim(coalesce(p_query, '')), '^@+', '')) as username
  ),
  matched as (
    select p.id,
      (
        ts_rank(to_tsvector('simple', p.caption), q.ts)
        + case when exists (
            select 1 from public.post_hashtags ph join public.hashtags h on h.id = ph.hashtag_id
            where ph.post_id = p.id and h.name = q.tag
          ) then 0.5 else 0 end
        + case when a.username = q.username then 0.5 else 0 end
      ) * public.post_base_score(p.like_count, p.comment_count, p.repost_count, p.play_count,
        p.published_at, now()) as score
    from public.posts p
    join public.profiles a on a.id = p.author_id, q
    where trim(coalesce(p_query, '')) <> ''
      and p.status = 'published'
      and p.archived_at is null
      and (p_kind <> 'reels' or p.kind = 'reel')
      and (
        to_tsvector('simple', p.caption) @@ q.ts
        or a.username = q.username
        or exists (
          select 1 from public.post_hashtags ph join public.hashtags h on h.id = ph.hashtag_id
          where ph.post_id = p.id and h.name = q.tag
        )
      )
      and not exists (
        select 1 from public.post_hides x where x.user_id = auth.uid() and x.post_id = p.id
      )
  )
  select t.id, t.author_id, t.kind, t.cover_path, t.cover_type, t.media_count, t.play_count,
    t.cover_offset
  from matched m
  cross join lateral public.post_tile(m.id) t
  order by m.score desc, m.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------------------------
-- Recent searches (page 67)
-- ---------------------------------------------------------------------------------------------
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null,
  target_id uuid,
  query text,
  searched_at timestamptz not null default now(),
  constraint search_history_kind check (kind in ('account', 'hashtag', 'audio', 'keyword')),
  constraint search_history_shape check (
    case when kind = 'keyword'
      then target_id is null and query is not null and char_length(trim(query)) between 1 and 100
      else target_id is not null and query is null
    end
  )
);

create unique index search_history_entry_idx
  on public.search_history (user_id, kind, (coalesce(target_id::text, lower(query))));
create index search_history_user_idx on public.search_history (user_id, searched_at desc);

alter table public.search_history enable row level security;

create policy search_history_select_own on public.search_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy search_history_delete_own on public.search_history
  for delete to authenticated using (user_id = (select auth.uid()));
-- Writes only via record_search().
revoke insert, update on public.search_history from anon, authenticated;

-- Save (or bump) an opened result / submitted keyword; keeps the newest 50.
create function public.record_search(p_kind text, p_target uuid default null, p_query text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind = 'keyword' then
    if v_query is null then
      raise exception 'invalid_search';
    end if;
    p_target := null;
  else
    v_query := null;
    if p_target is null
      or (p_kind = 'account' and not exists (select 1 from public.profiles where id = p_target))
      or (p_kind = 'hashtag' and not exists (select 1 from public.hashtags where id = p_target))
      or (p_kind = 'audio' and not exists (
        select 1 from public.audio_tracks t
        where t.id = p_target
          and (t.source <> 'original' or t.owner_id = v_me or public.can_view_post(t.origin_post_id))
      ))
      or p_kind not in ('account', 'hashtag', 'audio')
    then
      raise exception 'invalid_search';
    end if;
  end if;

  insert into public.search_history (user_id, kind, target_id, query)
  values (v_me, p_kind, p_target, left(v_query, 100))
  on conflict (user_id, kind, (coalesce(target_id::text, lower(query))))
  do update set searched_at = now(), query = excluded.query;

  delete from public.search_history
  where user_id = v_me
    and id not in (
      select id from public.search_history where user_id = v_me
      order by searched_at desc limit 50
    );
end;
$$;

-- My recent searches, newest first, with each target's display data. Targets that are gone or
-- no longer visible (deleted account, unused tag, hidden original audio) are skipped.
create function public.recent_searches(p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  target_id uuid,
  query text,
  searched_at timestamptz,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  i_follow boolean,
  tag_name text,
  post_count integer,
  audio_title text,
  audio_artist text,
  audio_source text,
  audio_cover_color text,
  audio_owner_avatar_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.kind, s.target_id, s.query, s.searched_at,
    p.username, p.full_name, p.avatar_path, p.is_private,
    exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    ),
    h.name, h.post_count,
    t.title, t.artist, t.source, t.cover_color, o.avatar_path
  from public.search_history s
  left join public.profiles p on s.kind = 'account' and p.id = s.target_id
  left join public.hashtags h on s.kind = 'hashtag' and h.id = s.target_id
  left join public.audio_tracks t on s.kind = 'audio' and t.id = s.target_id
  left join public.profiles o on o.id = t.owner_id
  where s.user_id = auth.uid()
    and case s.kind
      when 'account' then p.id is not null
      when 'hashtag' then h.id is not null
      when 'audio' then t.id is not null
      else true
    end
  order by s.searched_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports on hashtags (hashtag page ⋯ → Report)
-- ---------------------------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_valid;
alter table public.reports add constraint reports_target_type_valid
  check (target_type in ('post', 'comment', 'profile', 'story', 'audio', 'hashtag'));

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  new.status := 'open';
  new.created_at := now();
  if new.target_type = 'post' then
    select author_id into v_owner from public.posts where id = new.target_id;
    if v_owner is null or not public.can_view_post(new.target_id) then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'comment' then
    select c.author_id into v_owner from public.comments c where c.id = new.target_id;
    if v_owner is null or not exists (
      select 1 from public.comments c where c.id = new.target_id and public.can_view_post(c.post_id)
    ) then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'story' then
    select author_id into v_owner from public.stories where id = new.target_id;
    if v_owner is null or not public.can_view_story(new.target_id) then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'audio' then
    -- Catalog tracks have no owner; original audio must be visible and not your own.
    if not exists (
      select 1 from public.audio_tracks t
      where t.id = new.target_id
        and (t.source <> 'original' or public.can_view_post(t.origin_post_id))
    ) then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
    select owner_id into v_owner from public.audio_tracks where id = new.target_id;
  elsif new.target_type = 'hashtag' then
    -- Hashtags have no owner.
    if not exists (select 1 from public.hashtags h where h.id = new.target_id) then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  else
    select id into v_owner from public.profiles where id = new.target_id;
    if v_owner is null then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  end if;
  if v_owner = new.reporter_id then
    raise exception 'cannot_report_self' using errcode = '22023';
  end if;
  if new.target_type = 'post' then
    insert into public.post_hides (user_id, post_id, reason)
    values (new.reporter_id, new.target_id, 'reported')
    on conflict (user_id, post_id) do update set reason = 'reported';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reserve the new route names (/search, /recent-searches, /tags, /explore-feed)
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
      'about', 'accounts', 'admin', 'administrator', 'api', 'archive', 'audio', 'compose',
      'create', 'dev', 'direct', 'explore', 'explore-feed', 'favorites', 'feed', 'help',
      'highlights', 'humans', 'instagram', 'legal', 'login', 'logout', 'null', 'p', 'profile',
      'qr', 'recent-searches', 'reel', 'reel-create', 'reels', 'report', 'root', 'saved',
      'search', 'settings', 'signup', 'stories', 'story', 'support', 'tags', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.post_tile(uuid) from public, anon;
revoke execute on function public.post_base_score(integer, integer, integer, integer, timestamptz, timestamptz) from public, anon;
revoke execute on function public.explore_grid(timestamptz, integer, integer) from public, anon;
revoke execute on function public.similar_posts(uuid, timestamptz, integer, integer) from public, anon;
revoke execute on function public.normalize_hashtag(text) from public, anon;
revoke execute on function public.hashtag_page(text) from public, anon;
revoke execute on function public.hashtag_posts(text, text, integer, integer) from public, anon;
revoke execute on function public.search_accounts(text, integer, integer) from public, anon;
revoke execute on function public.search_hashtags(text, integer, integer) from public, anon;
revoke execute on function public.search_audio(text, integer, integer) from public, anon;
revoke execute on function public.search_posts(text, text, integer, integer) from public, anon;
revoke execute on function public.record_search(text, uuid, text) from public, anon;
revoke execute on function public.recent_searches(integer) from public, anon;

grant execute on function public.post_tile(uuid) to authenticated;
grant execute on function public.post_base_score(integer, integer, integer, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.explore_grid(timestamptz, integer, integer) to authenticated;
grant execute on function public.similar_posts(uuid, timestamptz, integer, integer) to authenticated;
grant execute on function public.normalize_hashtag(text) to authenticated;
grant execute on function public.hashtag_page(text) to authenticated;
grant execute on function public.hashtag_posts(text, text, integer, integer) to authenticated;
grant execute on function public.search_accounts(text, integer, integer) to authenticated;
grant execute on function public.search_hashtags(text, integer, integer) to authenticated;
grant execute on function public.search_audio(text, integer, integer) to authenticated;
grant execute on function public.search_posts(text, text, integer, integer) to authenticated;
grant execute on function public.record_search(text, uuid, text) to authenticated;
grant execute on function public.recent_searches(integer) to authenticated;
