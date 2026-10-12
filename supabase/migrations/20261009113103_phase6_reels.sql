-- Phase 6 — Reels (pages 58–64). Decisions: docs/DECISIONS.md 2026-10-09.
--
-- * Reels are posts (`posts.kind = 'reel'`), so likes, comments, saves, reposts, reports and
--   post_cards work unchanged. Single-video posts are reels too (like Instagram).
-- * Edit list played live (no encoding): clips are post_media rows uploaded as recorded;
--   `posts.reel` holds the edit document (clip order, trims, speed, voiceovers, volumes, timed
--   overlays, remix trims). Files stay in the `posts` bucket ({author}/{post}/…), so the existing
--   can_view_post_object() policy covers reels; the Phase 0 `reels` bucket is left unused.
-- * Cover image (`cover_path`) + the 3:4 grid window (`cover_offset`).
-- * Plays: reel_plays (per viewer) + trigger-free counter `posts.play_count` via record_reel_play().
-- * Original audio: publishing a reel without music creates an `audio_tracks` row
--   (source 'original') pointing at the reel; others can "Use audio" (the app plays the origin
--   reel's sound). Audio page RPCs, rename, reports on audio.
-- * Remix (side-by-side, react, sequence) and linked reels ("Watch next part").

-- ---------------------------------------------------------------------------------------------
-- posts: kind + reel columns
-- ---------------------------------------------------------------------------------------------
alter table public.posts
  add column kind text not null default 'post',
  add column reel jsonb,
  add column cover_path text,
  add column cover_offset real not null default 0.5,
  add column play_count integer not null default 0,
  add column allow_remix boolean not null default true,
  add column allow_download boolean not null default true,
  add column remix_of uuid references public.posts (id) on delete set null,
  add column remix_layout text,
  add column linked_reel_id uuid references public.posts (id) on delete set null;

alter table public.posts
  add constraint posts_kind_valid check (kind in ('post', 'reel')),
  add constraint posts_reel_doc_valid check (
    reel is null or (kind = 'reel' and jsonb_typeof(reel) = 'object' and pg_column_size(reel) < 65536)
  ),
  add constraint posts_cover_offset_range check (cover_offset between 0 and 1),
  add constraint posts_remix_layout_valid check (
    remix_layout is null or (kind = 'reel' and remix_layout in ('side_by_side', 'react', 'sequence'))
  ),
  add constraint posts_not_self_linked check (linked_reel_id is null or linked_reel_id <> id);

comment on column public.posts.reel is
  'Reel edit document v1: clips [{media_id,in_ms,out_ms,speed}], volumes, voiceovers, overlays, remix. Null = play the single clip as is.';
comment on column public.posts.remix_layout is
  'Set on remixes; remix_of becomes null when the original is deleted ("Content unavailable").';

-- Reels are 9:16 (anything from 1:2); posts keep 3:4 … 1.91:1.
alter table public.posts drop constraint posts_aspect_ratio_range;
alter table public.posts add constraint posts_aspect_ratio_range check (
  aspect_ratio between (case when kind = 'reel' then 0.5 else 0.75 end) and 1.91
);

create index posts_reels_published_idx on public.posts (published_at desc)
  where status = 'published' and kind = 'reel';
create index posts_remix_of_idx on public.posts (remix_of) where remix_of is not null;
create index posts_linked_reel_idx on public.posts (linked_reel_id) where linked_reel_id is not null;

-- Existing single-video posts become reels (Instagram has done this since 2022).
update public.posts p set kind = 'reel'
where (select count(*) from public.post_media m where m.post_id = p.id) = 1
  and exists (select 1 from public.post_media m where m.post_id = p.id and m.type = 'video');

revoke insert, update on public.posts from anon, authenticated;
grant insert (id, caption, aspect_ratio, audience, hide_like_counts, comments_disabled,
              audio_track_id, audio_start_ms, kind, reel, cover_path, cover_offset,
              allow_remix, allow_download, remix_of, remix_layout, linked_reel_id)
  on public.posts to authenticated;
grant update (caption, hide_like_counts, comments_disabled, archived_at, pinned_at,
              allow_remix, allow_download)
  on public.posts to authenticated;

-- Reel rules checked on insert (definer: the remix source may belong to someone else).
create function public.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.posts;
  v_src_private boolean;
begin
  if new.cover_path is not null
     and new.cover_path not like new.author_id::text || '/' || new.id::text || '/%' then
    raise exception 'bad_cover_path' using errcode = '22023';
  end if;
  if new.kind = 'post' and (new.cover_path is not null or new.remix_of is not null
                            or new.linked_reel_id is not null) then
    raise exception 'reel_only' using errcode = '22023';
  end if;

  if (new.remix_of is null) <> (new.remix_layout is null) then
    raise exception 'bad_remix' using errcode = '22023';
  end if;
  if new.remix_of is not null then
    select * into v_src from public.posts where id = new.remix_of;
    select is_private into v_src_private from public.profiles where id = v_src.author_id;
    if not found or v_src.kind <> 'reel' or v_src.status <> 'published'
       or v_src.archived_at is not null
       or not public.can_view_post(v_src.id) then
      raise exception 'remix_source_not_found' using errcode = 'P0002';
    end if;
    if v_src.author_id <> new.author_id
       and (not v_src.allow_remix or v_src.audience <> 'everyone' or v_src_private) then
      raise exception 'remix_not_allowed' using errcode = '22023';
    end if;
  end if;

  if new.linked_reel_id is not null and not exists (
    select 1 from public.posts l
    where l.id = new.linked_reel_id and l.author_id = new.author_id and l.kind = 'reel'
      and l.status = 'published'
  ) then
    raise exception 'linked_reel_not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger posts_before_insert
  before insert on public.posts
  for each row execute function public.posts_before_insert();

-- ---------------------------------------------------------------------------------------------
-- post_media: reels have up to 50 clips of up to 3 minutes
-- ---------------------------------------------------------------------------------------------
alter table public.post_media drop constraint post_media_position_range;
alter table public.post_media add constraint post_media_position_range check (position between 0 and 49);
alter table public.post_media drop constraint post_media_video_duration;
alter table public.post_media add constraint post_media_video_duration
  check (duration_ms is null or duration_ms between 1 and 180500);

create or replace function public.post_media_before_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if tg_op = 'INSERT' then
    select kind into v_kind from public.posts where id = new.post_id;
    if (select count(*) from public.post_media where post_id = new.post_id)
       >= (case when v_kind = 'reel' then 50 else 20 end) then
      raise exception 'media_limit' using errcode = '22023';
    end if;
    -- Carousel videos stay ≤ 60 s; reel clips may be up to 3 minutes.
    if v_kind = 'post' and coalesce(new.duration_ms, 0) > 60500 then
      raise exception 'video_too_long' using errcode = '22023';
    end if;
    return new;
  end if;
  -- DELETE: a published post keeps at least one slide (cascades from a deleted post pass,
  -- because the parent row is already gone).
  if exists (select 1 from public.posts where id = old.post_id and status = 'published')
     and (select count(*) from public.post_media where post_id = old.post_id) <= 1 then
    raise exception 'last_media' using errcode = '22023';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Original audio (page 62)
-- ---------------------------------------------------------------------------------------------
alter table public.audio_tracks
  alter column audio_path drop not null,
  add column owner_id uuid references public.profiles (id) on delete cascade,
  add column origin_post_id uuid references public.posts (id) on delete cascade,
  add column renamed_at timestamptz;

alter table public.audio_tracks
  add constraint audio_tracks_original_valid check (
    (source = 'original') = (origin_post_id is not null)
    and (source = 'original' or audio_path is not null)
    and (source <> 'original' or owner_id is not null)
  ),
  add constraint audio_tracks_title_length check (char_length(title) between 1 and 100),
  add constraint audio_tracks_origin_unique unique (origin_post_id);

create index audio_tracks_owner_idx on public.audio_tracks (owner_id) where owner_id is not null;

-- Catalog tracks: everyone. Original audio: when its reel is visible (or it's yours).
drop policy audio_tracks_select_authenticated on public.audio_tracks;
create policy audio_tracks_select_visible on public.audio_tracks
  for select to authenticated
  using (
    source <> 'original'
    or owner_id = (select auth.uid())
    or public.can_view_post(origin_post_id)
  );

-- Saving needs a visible track.
drop policy saved_audio_insert_owner on public.saved_audio;
create policy saved_audio_insert_owner on public.saved_audio
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.audio_tracks t where t.id = track_id)
  );

-- Owner renames their original audio (page 61 / 62).
create function public.rename_original_audio(p_track uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) not between 1 and 60 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  update public.audio_tracks
  set title = v_title, renamed_at = now()
  where id = p_track and source = 'original' and owner_id = auth.uid();
  if not found then
    raise exception 'track_not_found' using errcode = 'P0002';
  end if;
  return v_title;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Publishing: + cover / voiceovers / reel document checks, original audio
-- ---------------------------------------------------------------------------------------------
create or replace function public.publish_post(p_post uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts;
  v_count integer;
  v_missing integer;
  v_prefix text;
  v_total numeric := 0;
  v_username text;
begin
  select * into v_post from public.posts where id = p_post for update;
  if not found or v_post.author_id <> auth.uid() then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;
  if v_post.status = 'published' then
    return v_post.published_at;
  end if;

  select count(*) into v_count from public.post_media where post_id = p_post;
  if v_count = 0 then
    raise exception 'no_media' using errcode = '22023';
  end if;

  v_prefix := v_post.author_id::text || '/' || v_post.id::text || '/';

  -- Reel document: clips refer to this post's media; voiceovers live in the post's folder.
  if v_post.reel is not null then
    if jsonb_typeof(v_post.reel -> 'clips') <> 'array'
       or jsonb_array_length(v_post.reel -> 'clips') = 0 then
      raise exception 'bad_reel' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_post.reel -> 'clips') c
      where not exists (
          select 1 from public.post_media m
          where m.post_id = p_post and m.id::text = c ->> 'media_id'
        )
        or coalesce((c ->> 'in_ms')::numeric, -1) < 0
        or coalesce((c ->> 'out_ms')::numeric, 0) <= (c ->> 'in_ms')::numeric
        or coalesce((c ->> 'speed')::numeric, 0) not between 0.25 and 4
    ) then
      raise exception 'bad_reel' using errcode = '22023';
    end if;
    select coalesce(sum(((c ->> 'out_ms')::numeric - (c ->> 'in_ms')::numeric)
                        / (c ->> 'speed')::numeric), 0)
    into v_total
    from jsonb_array_elements(v_post.reel -> 'clips') c;
    if v_total > 180500 then
      raise exception 'reel_too_long' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(coalesce(v_post.reel -> 'voiceovers', '[]'::jsonb)) vo
      where coalesce(vo ->> 'path', '') not like v_prefix || '%'
    ) then
      raise exception 'bad_voiceover_path' using errcode = '22023';
    end if;
  elsif v_post.kind = 'reel' then
    select coalesce(sum(coalesce(duration_ms, 3000)), 0) into v_total
    from public.post_media where post_id = p_post;
  end if;

  select count(*) into v_missing
  from (
    select f.path
    from public.post_media m
    cross join lateral unnest(array[m.path, m.thumb_path]) as f(path)
    where m.post_id = p_post
    union all
    select v_post.cover_path
    union all
    select vo ->> 'path'
    from jsonb_array_elements(coalesce(v_post.reel -> 'voiceovers', '[]'::jsonb)) vo
  ) files
  where files.path is not null
    and not exists (
      select 1 from storage.objects o where o.bucket_id = 'posts' and o.name = files.path
    );
  if v_missing > 0 then
    raise exception 'media_missing' using errcode = '22023';
  end if;

  -- A reel without music gets its own "Original audio" (needs at least one video clip).
  if v_post.kind = 'reel' and v_post.audio_track_id is null and exists (
    select 1 from public.post_media where post_id = p_post and type = 'video'
  ) then
    select username into v_username from public.profiles where id = v_post.author_id;
    insert into public.audio_tracks
      (title, artist, duration_ms, audio_path, source, license, owner_id, origin_post_id)
    values
      ('Original audio', v_username, greatest(round(v_total)::integer, 1), null, 'original',
       'original', v_post.author_id, v_post.id)
    on conflict (origin_post_id) do nothing;
    update public.posts
    set audio_track_id = (select id from public.audio_tracks where origin_post_id = p_post)
    where id = p_post;
  end if;

  update public.posts
  set status = 'published', published_at = now()
  where id = p_post;
  return now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Plays (page 58): one row per viewer; repeat plays count after a short gap
-- ---------------------------------------------------------------------------------------------
create table public.reel_plays (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  plays integer not null default 1,
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index reel_plays_post_idx on public.reel_plays (post_id);

alter table public.reel_plays enable row level security;
create policy reel_plays_select_own on public.reel_plays
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.reel_plays from anon, authenticated;

-- Count a play (the app calls it once a reel has played for a moment). Own plays don't count.
create function public.record_reel_play(p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_counted boolean := false;
begin
  if v_me is null or not public.can_view_post(p_post) then
    return;
  end if;
  if not exists (
    select 1 from public.posts
    where id = p_post and status = 'published' and author_id <> v_me
  ) then
    return;
  end if;

  insert into public.reel_plays (user_id, post_id) values (v_me, p_post)
  on conflict (user_id, post_id) do nothing;
  if found then
    v_counted := true;
  else
    update public.reel_plays
    set plays = plays + 1, last_played_at = now()
    where user_id = v_me and post_id = p_post and last_played_at < now() - interval '5 seconds';
    v_counted := found;
  end if;

  if v_counted then
    update public.posts set play_count = play_count + 1 where id = p_post;
  end if;
  insert into public.post_seen (user_id, post_id) values (v_me, p_post)
  on conflict (user_id, post_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Cards: + reel fields (kind, document, cover, plays, remix, linked reel, audio source)
-- ---------------------------------------------------------------------------------------------
create or replace function public.post_cards(p_ids uuid[])
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'author_id', p.author_id,
    'author', jsonb_build_object(
      'id', a.id, 'username', a.username, 'full_name', a.full_name,
      'avatar_path', a.avatar_path, 'is_private', a.is_private
    ),
    'kind', p.kind,
    'caption', p.caption,
    'aspect_ratio', p.aspect_ratio,
    'audience', p.audience,
    'hide_like_counts', p.hide_like_counts,
    'comments_disabled', p.comments_disabled,
    'archived_at', p.archived_at,
    'pinned_at', p.pinned_at,
    'published_at', p.published_at,
    'edited_at', p.edited_at,
    'audio_start_ms', p.audio_start_ms,
    'audio', (
      select jsonb_build_object(
        'id', t.id, 'title', t.title, 'artist', t.artist,
        'audio_path', t.audio_path, 'duration_ms', t.duration_ms,
        'source', t.source, 'origin_post_id', t.origin_post_id, 'cover_color', t.cover_color,
        'owner', (
          select jsonb_build_object('id', o.id, 'username', o.username, 'avatar_path', o.avatar_path)
          from public.profiles o where o.id = t.owner_id
        )
      )
      from public.audio_tracks t where t.id = p.audio_track_id
    ),
    'reel', p.reel,
    'cover_path', p.cover_path,
    'cover_offset', p.cover_offset,
    -- "Hide like and view counts": only the author sees the numbers.
    'play_count', case
      when p.hide_like_counts and p.author_id <> auth.uid() then null else p.play_count end,
    'allow_remix', p.allow_remix,
    'allow_download', p.allow_download,
    'can_remix', (
      p.kind = 'reel' and p.status = 'published' and p.archived_at is null and (
        p.author_id = auth.uid()
        or (p.allow_remix and p.audience = 'everyone' and not a.is_private)
      )
    ),
    'remix', case when p.remix_layout is not null then jsonb_build_object(
      'layout', p.remix_layout,
      'post_id', p.remix_of,
      'username', (
        select o.username from public.posts op join public.profiles o on o.id = op.author_id
        where op.id = p.remix_of
      )
    ) end,
    'remix_count', (
      select count(*) from public.posts r
      where r.remix_of = p.id and r.status = 'published' and r.archived_at is null
    ),
    'linked_reel_id', case
      when p.linked_reel_id is not null and public.can_view_post(p.linked_reel_id)
      then p.linked_reel_id end,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'position', m.position, 'type', m.type, 'path', m.path,
        'thumb_path', m.thumb_path, 'width', m.width, 'height', m.height,
        'duration_ms', m.duration_ms, 'alt_text', m.alt_text
      ) order by m.position)
      from public.post_media m where m.post_id = p.id
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tg.id, 'media_id', tg.media_id, 'x', tg.x, 'y', tg.y,
        'user', jsonb_build_object('id', u.id, 'username', u.username)
      ))
      from public.post_tags tg join public.profiles u on u.id = tg.tagged_user_id
      where tg.post_id = p.id
    ), '[]'::jsonb),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', c.user_id, 'status', c.status,
        'user', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_path', u.avatar_path)
      ) order by c.invited_at)
      from public.post_collaborators c join public.profiles u on u.id = c.user_id
      where c.post_id = p.id
    ), '[]'::jsonb),
    -- Hidden like counts: only the author sees the number.
    'like_count', case
      when p.hide_like_counts and p.author_id <> auth.uid() then null else p.like_count end,
    'comment_count', p.comment_count,
    'repost_count', p.repost_count,
    'liked', exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    'saved', exists (select 1 from public.saves s where s.post_id = p.id and s.user_id = auth.uid()),
    'reposted', exists (
      select 1 from public.reposts r where r.post_id = p.id and r.user_id = auth.uid()
    ),
    'can_repost', (
      p.author_id <> auth.uid() and p.audience = 'everyone' and not a.is_private
      and p.archived_at is null
    ),
    'i_follow_author', exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.author_id
    ),
    'requested_author', exists (
      select 1 from public.follow_requests fr
      where fr.requester_id = auth.uid() and fr.target_id = p.author_id
    ),
    'is_favorite_author', exists (
      select 1 from public.favorites fv where fv.owner_id = auth.uid() and fv.favorite_id = p.author_id
    ),
    -- "Liked by <someone you follow> and others".
    'liked_by', (
      select jsonb_build_object('username', u.username, 'avatar_path', u.avatar_path)
      from public.likes l
      join public.follows f on f.following_id = l.user_id and f.follower_id = auth.uid()
      join public.profiles u on u.id = l.user_id
      where l.post_id = p.id
      order by l.created_at desc
      limit 1
    ),
    -- Up to 2 preview comments: people you follow / your own first, then most liked.
    'preview_comments', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'username', x.username, 'body', x.body))
      from (
        select c.id, u.username, c.body
        from public.comments c join public.profiles u on u.id = c.author_id
        where c.post_id = p.id and c.parent_id is null and c.hidden_at is null
        order by
          (c.author_id = auth.uid() or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = c.author_id
          )) desc,
          c.pinned_at is not null desc,
          c.like_count desc,
          c.created_at desc
        limit 2
      ) x
    ), '[]'::jsonb)
  )
  from unnest(p_ids) with ordinality as ids(id, ord)
  join public.posts p on p.id = ids.id
  join public.profiles a on a.id = p.author_id
  order by ids.ord;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reels feed (page 58): followed + recommended public reels, ranked; seen reels sink
-- ---------------------------------------------------------------------------------------------
create function public.reels_feed(
  p_snapshot timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 8
)
returns table (post_id uuid, reason text, score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  cand as (
    select p.id, p.author_id, p.published_at, p.like_count, p.comment_count, p.repost_count,
      p.play_count,
      exists (
        select 1 from public.follows f, me where f.follower_id = me.id and f.following_id = p.author_id
      ) as followed,
      exists (
        select 1 from public.favorites fv, me where fv.owner_id = me.id and fv.favorite_id = p.author_id
      ) as favorite,
      p.author_id = (select id from me) as own,
      a.is_private
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.kind = 'reel'
      and p.status = 'published'
      and p.archived_at is null
      and p.published_at <= p_snapshot
      and not exists (
        select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = p.id
      )
  )
  select c.id,
    case when c.own then 'own' when c.followed then 'following' else 'suggested' end,
    (
      ln(3 + coalesce(c.like_count, 0) + 2 * c.comment_count + 3 * c.repost_count
         + c.play_count / 20.0)
      / power(1 + extract(epoch from (p_snapshot - c.published_at)) / 3600.0 / 72.0, 0.9)
      * case when c.favorite then 1.5 when c.followed then 1.3 else 1 end
      -- Your own reel right after sharing comes first.
      * case when c.own and c.published_at > p_snapshot - interval '1 hour' then 6 else 1 end
      * case when exists (
          select 1 from public.reel_plays rp, me
          where rp.user_id = me.id and rp.post_id = c.id and rp.last_played_at < p_snapshot
        ) or exists (
          select 1 from public.post_seen s, me
          where s.user_id = me.id and s.post_id = c.id and s.seen_at < p_snapshot
        ) then 0.1 else 1 end
      * case when exists (
          select 1 from public.post_hides h join public.posts hp on hp.id = h.post_id, me
          where h.user_id = me.id and h.reason = 'not_interested' and hp.author_id = c.author_id
        ) then 0.2 else 1 end
    )::double precision as score
  from cand c
  where (
      (c.own and c.published_at > p_snapshot - interval '1 day')
      or c.followed
      or (not c.own and not c.is_private)
    )
    -- can_view_post covers private / Close Friends reels of followed accounts.
    and public.can_view_post(c.id)
  order by score desc, c.published_at desc, c.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 30);
$$;

-- ---------------------------------------------------------------------------------------------
-- Profile grids: + kind 'reels', kind + play_count + reel cover
-- ---------------------------------------------------------------------------------------------
drop function public.profile_posts(uuid, text, integer, integer);
create function public.profile_posts(
  p_user uuid,
  p_kind text default 'grid',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  cover_path text,
  cover_type text,
  media_count integer,
  audience text,
  is_pinned boolean,
  published_at timestamptz,
  archived_at timestamptz,
  kind text,
  play_count integer,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.author_id,
    coalesce(p.cover_path, m.thumb_path, m.path) as cover_path,
    case when p.cover_path is not null then 'image' else m.type end as cover_type,
    (select count(*)::integer from public.post_media x where x.post_id = p.id) as media_count,
    p.audience,
    (p_kind = 'grid' and p.author_id = p_user and p.pinned_at is not null) as is_pinned,
    p.published_at,
    p.archived_at,
    p.kind,
    case when p.hide_like_counts and p.author_id <> auth.uid() then null else p.play_count end,
    p.cover_offset
  from public.posts p
  left join public.reposts r on p_kind = 'reposts' and r.post_id = p.id and r.user_id = p_user
  left join lateral (
    select pm.path, pm.thumb_path, pm.type from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where p.status = 'published'
    and case p_kind
      when 'grid' then p.archived_at is null and (
        p.author_id = p_user
        or exists (
          select 1 from public.post_collaborators c
          where c.post_id = p.id and c.user_id = p_user and c.status = 'accepted'
        )
      )
      when 'reels' then p.archived_at is null and p.kind = 'reel' and (
        p.author_id = p_user
        or exists (
          select 1 from public.post_collaborators c
          where c.post_id = p.id and c.user_id = p_user and c.status = 'accepted'
        )
      )
      when 'tagged' then p.archived_at is null and exists (
        select 1 from public.post_tags t where t.post_id = p.id and t.tagged_user_id = p_user
      )
      when 'archived' then p.author_id = p_user and p_user = auth.uid() and p.archived_at is not null
      when 'reposts' then p.archived_at is null and r.user_id is not null
      else false
    end
  order by
    (p_kind = 'grid' and p.author_id = p_user and p.pinned_at is not null) desc,
    case when p_kind = 'grid' and p.author_id = p_user then p.pinned_at end desc nulls last,
    case
      when p_kind = 'archived' then p.archived_at
      when p_kind = 'reposts' then r.created_at
      else p.published_at
    end desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- Saved grids show reel covers too.
create or replace function public.saved_posts(
  p_collection uuid default null,
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  cover_path text,
  cover_type text,
  media_count integer,
  saved_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.author_id,
    coalesce(p.cover_path, m.thumb_path, m.path),
    case when p.cover_path is not null then 'image' else m.type end,
    (select count(*)::integer from public.post_media x where x.post_id = p.id),
    coalesce(i.created_at, s.created_at)
  from public.saves s
  join public.posts p on p.id = s.post_id
  left join public.saved_collection_items i
    on p_collection is not null and i.collection_id = p_collection and i.post_id = s.post_id
  left join lateral (
    select pm.path, pm.thumb_path, pm.type from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where s.user_id = auth.uid()
    and (p_collection is null or i.post_id is not null)
  order by coalesce(i.created_at, s.created_at) desc, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------------------------
-- Audio page (page 62), remixes (page 63)
-- ---------------------------------------------------------------------------------------------
create function public.audio_page(p_track uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'artist', t.artist,
    'audio_path', t.audio_path,
    'duration_ms', t.duration_ms,
    'cover_color', t.cover_color,
    'source', t.source,
    'origin_post_id', t.origin_post_id,
    'renamed_at', t.renamed_at,
    'owner', (
      select jsonb_build_object('id', o.id, 'username', o.username, 'avatar_path', o.avatar_path)
      from public.profiles o where o.id = t.owner_id
    ),
    'is_owner', coalesce(t.owner_id = auth.uid(), false),
    'saved', exists (
      select 1 from public.saved_audio s where s.track_id = t.id and s.user_id = auth.uid()
    ),
    -- All published reels with this sound (Instagram shows the total, not just visible ones).
    'reel_count', (
      select count(*) from public.posts p
      where p.audio_track_id = t.id and p.kind = 'reel' and p.status = 'published'
        and p.archived_at is null
    )
  )
  from public.audio_tracks t
  where t.id = p_track;
$$;

-- Reels using a sound: the original reel first, then most played / liked.
create function public.audio_reels(
  p_track uuid,
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  cover_path text,
  play_count integer,
  is_origin boolean,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.author_id,
    coalesce(p.cover_path, m.thumb_path, m.path),
    case when p.hide_like_counts and p.author_id <> auth.uid() then null else p.play_count end,
    p.id = t.origin_post_id,
    p.cover_offset
  from public.posts p
  join public.audio_tracks t on t.id = p.audio_track_id
  left join lateral (
    select pm.path, pm.thumb_path from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where p.audio_track_id = p_track
    and p.kind = 'reel'
    and p.status = 'published'
    and p.archived_at is null
    and not exists (
      select 1 from public.post_hides h where h.user_id = auth.uid() and h.post_id = p.id
    )
  order by (p.id = t.origin_post_id) desc,
    (p.play_count + 5 * p.like_count + 10 * p.comment_count) desc,
    p.published_at desc, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

create function public.reel_remixes(
  p_post uuid,
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  author_id uuid,
  cover_path text,
  play_count integer,
  cover_offset real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.author_id,
    coalesce(p.cover_path, m.thumb_path, m.path),
    case when p.hide_like_counts and p.author_id <> auth.uid() then null else p.play_count end,
    p.cover_offset
  from public.posts p
  left join lateral (
    select pm.path, pm.thumb_path from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where p.remix_of = p_post
    and p.status = 'published'
    and p.archived_at is null
  order by p.published_at desc, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- Own reels to link as "Watch next part" (page 61).
create function public.my_reels(p_limit integer default 60)
returns table (id uuid, cover_path text, caption text, published_at timestamptz, cover_offset real)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, coalesce(p.cover_path, m.thumb_path, m.path), p.caption, p.published_at,
    p.cover_offset
  from public.posts p
  left join lateral (
    select pm.path, pm.thumb_path from public.post_media pm
    where pm.post_id = p.id order by pm.position limit 1
  ) m on true
  where p.author_id = auth.uid() and p.kind = 'reel' and p.status = 'published'
  order by p.published_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports: + audio
-- ---------------------------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_valid;
alter table public.reports add constraint reports_target_type_valid
  check (target_type in ('post', 'comment', 'profile', 'story', 'audio'));

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
-- posts bucket: voiceover recordings (m4a / aac; webm from browsers)
-- ---------------------------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','video/mp4',
  'video/quicktime','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/mpeg','audio/webm',
  'audio/wav']
where id = 'posts';

-- ---------------------------------------------------------------------------------------------
-- Reserve the new route names (/reel-create, /audio)
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
      'create', 'dev', 'direct', 'explore', 'favorites', 'feed', 'help', 'highlights', 'humans',
      'instagram', 'legal', 'login', 'logout', 'null', 'p', 'profile', 'qr', 'reel',
      'reel-create', 'reels', 'report', 'root', 'saved', 'settings', 'signup', 'stories', 'story',
      'support', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.posts_before_insert() from public, anon, authenticated;
revoke execute on function public.rename_original_audio(uuid, text) from public, anon;
revoke execute on function public.record_reel_play(uuid) from public, anon;
revoke execute on function public.reels_feed(timestamptz, integer, integer) from public, anon;
revoke execute on function public.profile_posts(uuid, text, integer, integer) from public, anon;
revoke execute on function public.audio_page(uuid) from public, anon;
revoke execute on function public.audio_reels(uuid, integer, integer) from public, anon;
revoke execute on function public.reel_remixes(uuid, integer, integer) from public, anon;
revoke execute on function public.my_reels(integer) from public, anon;

grant execute on function public.rename_original_audio(uuid, text) to authenticated;
grant execute on function public.record_reel_play(uuid) to authenticated;
grant execute on function public.reels_feed(timestamptz, integer, integer) to authenticated;
grant execute on function public.profile_posts(uuid, text, integer, integer) to authenticated;
grant execute on function public.audio_page(uuid) to authenticated;
grant execute on function public.audio_reels(uuid, integer, integer) to authenticated;
grant execute on function public.reel_remixes(uuid, integer, integer) to authenticated;
grant execute on function public.my_reels(integer) to authenticated;
