-- Phase 3 — Content creation (pages 32–42; 38 Location dropped by decision).
--
-- * posts / post_media: created as `uploading` (visible only to the author), media uploaded to
--   posts/{author}/{post}/…, then publish_post() checks every file and publishes.
-- * can_view_post(): author, collaborators, or (published, not archived, can_view_profile(author),
--   and Close Friends membership for close-friends posts). Used by tables and the posts bucket.
-- * post_tags (positioned per slide), post_collaborators (invite → accept), post_mentions.
-- * hashtags / post_hashtags: minimal STUB for caption autocomplete (owned by Phase 7).
-- * audio_tracks / saved_audio + public `audio` bucket (placeholder royalty-free catalog).
-- * Archive, pin (≤3), hide like counts, turn off commenting, profiles.posts_count.
-- * saved_collection_items.post_id / saved_collections.cover_post_id get their FKs.

-- ---------------------------------------------------------------------------------------------
-- Music catalog (page 39)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 20971520,
        array['audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/aac','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- No storage.objects policies for `audio`: clients only read it by public URL; the catalog is
-- seeded with the service role (scripts/seed-audio.mjs).

create table public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  duration_ms integer not null check (duration_ms > 0),
  audio_path text not null unique,
  cover_color text not null default '#6C5CE7',
  source text not null default 'placeholder',
  license text not null default 'CC0',
  created_at timestamptz not null default now()
);

alter table public.audio_tracks enable row level security;
create policy audio_tracks_select_authenticated on public.audio_tracks
  for select to authenticated using (true);
revoke insert, update, delete on public.audio_tracks from anon, authenticated;

create table public.saved_audio (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  track_id uuid not null references public.audio_tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

alter table public.saved_audio enable row level security;
create policy saved_audio_select_owner on public.saved_audio
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_audio_insert_owner on public.saved_audio
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_audio_delete_owner on public.saved_audio
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.saved_audio from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------------------------

-- Instagram caption rules: ≤2,200 characters, ≤30 hashtags, ≤20 @mentions.
create function public.is_valid_caption(caption text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(caption) <= 2200
    and (select count(*) from regexp_matches(caption, '#[[:alnum:]_]+', 'g')) <= 30
    and (select count(*) from regexp_matches(caption, '@[A-Za-z0-9._]+', 'g')) <= 20;
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  caption text not null default '',
  -- width / height shared by every slide: 3:4 (0.75) … 1.91:1.
  aspect_ratio numeric(6, 4) not null default 1,
  status text not null default 'uploading',
  audience text not null default 'everyone',
  hide_like_counts boolean not null default false,
  comments_disabled boolean not null default false,
  audio_track_id uuid references public.audio_tracks (id) on delete set null,
  audio_start_ms integer not null default 0,
  archived_at timestamptz,
  pinned_at timestamptz,
  published_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_caption_valid check (public.is_valid_caption(caption)),
  constraint posts_aspect_ratio_range check (aspect_ratio between 0.75 and 1.91),
  constraint posts_status_valid check (status in ('uploading', 'published')),
  constraint posts_audience_valid check (audience in ('everyone', 'close_friends')),
  constraint posts_audio_start check (audio_start_ms >= 0)
);

comment on column public.posts.status is
  'uploading = only the author sees it; publish_post() flips it once every file is in storage.';

create index posts_author_published_idx on public.posts (author_id, published_at desc)
  where status = 'published';
create index posts_author_pinned_idx on public.posts (author_id) where pinned_at is not null;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  position smallint not null,
  type text not null,
  path text not null,
  thumb_path text,
  width integer not null,
  height integer not null,
  duration_ms integer,
  alt_text text,
  created_at timestamptz not null default now(),
  constraint post_media_position_range check (position between 0 and 19),
  constraint post_media_type_valid check (type in ('image', 'video')),
  constraint post_media_alt_length check (alt_text is null or char_length(alt_text) <= 1000),
  constraint post_media_size check (width > 0 and height > 0),
  constraint post_media_video_duration check (duration_ms is null or duration_ms between 1 and 60500),
  -- Deferrable so a reorder can swap positions in one statement.
  constraint post_media_position_unique unique (post_id, position) deferrable initially immediate
);

-- Collaborators (page 36; policies below). Created here because can_view_post reads it.
create table public.post_collaborators (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (post_id, user_id),
  constraint post_collaborators_status_valid check (status in ('pending', 'accepted'))
);

create index post_collaborators_user_idx on public.post_collaborators (user_id, status);

-- Who may see a post. Security definer so RLS on posts can call it without recursion.
create function public.can_view_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post
      and (
        p.author_id = auth.uid()
        or exists (
          select 1 from public.post_collaborators c
          where c.post_id = p.id and c.user_id = auth.uid()
        )
        or (
          p.status = 'published'
          and p.archived_at is null
          and public.can_view_profile(p.author_id)
          and (
            p.audience = 'everyone'
            or exists (
              select 1 from public.close_friends cf
              where cf.owner_id = p.author_id and cf.friend_id = auth.uid()
            )
          )
        )
      )
  );
$$;

-- Storage object name posts/{author}/{post}/{file} → can_view_post(post). Bad names → false.
create function public.can_view_post_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[2]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_view_post(((storage.foldername(object_name))[2])::uuid)
    else false
  end;
$$;

alter table public.posts enable row level security;
alter table public.post_media enable row level security;

create policy posts_select_visible on public.posts
  for select to authenticated using (public.can_view_post(id));
create policy posts_insert_owner on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'uploading');
create policy posts_update_owner on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete_owner on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- Clients write only these columns; status/published_at go through publish_post().
revoke insert, update on public.posts from anon, authenticated;
grant insert (id, caption, aspect_ratio, audience, hide_like_counts, comments_disabled,
              audio_track_id, audio_start_ms)
  on public.posts to authenticated;
grant update (caption, hide_like_counts, comments_disabled, archived_at, pinned_at)
  on public.posts to authenticated;

create policy post_media_select_visible on public.post_media
  for select to authenticated using (public.can_view_post(post_id));
create policy post_media_insert_owner on public.post_media
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid()) and p.status = 'uploading'
    )
    and path like (select auth.uid())::text || '/' || post_id::text || '/%'
    and (thumb_path is null
         or thumb_path like (select auth.uid())::text || '/' || post_id::text || '/%')
  );
create policy post_media_update_owner on public.post_media
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy post_media_delete_owner on public.post_media
  for delete to authenticated using (author_id = (select auth.uid()));

revoke insert, update on public.post_media from anon, authenticated;
grant insert (id, post_id, position, type, path, thumb_path, width, height, duration_ms, alt_text)
  on public.post_media to authenticated;
grant update (alt_text) on public.post_media to authenticated;

create index post_media_post_idx on public.post_media (post_id, position);

-- posts bucket: viewers of the post may read its files (owners already can, Phase 0).
create policy posts_select_viewer on storage.objects
  for select to authenticated
  using (bucket_id = 'posts' and public.can_view_post_object(name));

-- ---------------------------------------------------------------------------------------------
-- post triggers: limits, archive/pin rules, edited label, counters
-- ---------------------------------------------------------------------------------------------
create function public.post_media_before_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.post_media where post_id = new.post_id) >= 20 then
      raise exception 'media_limit' using errcode = '22023';
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

create trigger post_media_before_insert
  before insert on public.post_media
  for each row execute function public.post_media_before_change();
create trigger post_media_before_delete
  before delete on public.post_media
  for each row execute function public.post_media_before_change();

create function public.posts_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Archive/pin timestamps are server time; archiving unpins.
  if new.archived_at is distinct from old.archived_at and new.archived_at is not null then
    new.archived_at := now();
    new.pinned_at := null;
  end if;
  if new.pinned_at is distinct from old.pinned_at and new.pinned_at is not null then
    if new.status <> 'published' or new.archived_at is not null then
      raise exception 'cannot_pin' using errcode = '22023';
    end if;
    if (select count(*) from public.posts
        where author_id = new.author_id and pinned_at is not null and id <> new.id) >= 3 then
      raise exception 'pin_limit' using errcode = '22023';
    end if;
    new.pinned_at := now();
  end if;
  if old.status = 'published' and new.caption is distinct from old.caption then
    new.edited_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger posts_before_update
  before update on public.posts
  for each row execute function public.posts_before_update();

-- profiles.posts_count = published, not archived posts (Phase 2 left it at 0).
create function public.refresh_posts_count(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set posts_count = (
    select count(*) from public.posts
    where author_id = p_user and status = 'published' and archived_at is null
  )
  where id = p_user;
$$;

-- ---------------------------------------------------------------------------------------------
-- Hashtags (STUB owned by Phase 7) and mentions, parsed from published captions
-- ---------------------------------------------------------------------------------------------
create table public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  post_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint hashtags_name_valid check (name = lower(name) and char_length(name) between 1 and 100)
);

alter table public.hashtags enable row level security;
create policy hashtags_select_authenticated on public.hashtags
  for select to authenticated using (true);
revoke insert, update, delete on public.hashtags from anon, authenticated;

create index hashtags_name_pattern_idx on public.hashtags (name text_pattern_ops);

create table public.post_hashtags (
  post_id uuid not null references public.posts (id) on delete cascade,
  hashtag_id uuid not null references public.hashtags (id) on delete cascade,
  primary key (post_id, hashtag_id)
);

alter table public.post_hashtags enable row level security;
create policy post_hashtags_select_visible on public.post_hashtags
  for select to authenticated using (public.can_view_post(post_id));
revoke insert, update, delete on public.post_hashtags from anon, authenticated;

create index post_hashtags_hashtag_idx on public.post_hashtags (hashtag_id);

create table public.post_mentions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_mentions enable row level security;
create policy post_mentions_select_visible on public.post_mentions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_post(post_id));
revoke insert, update, delete on public.post_mentions from anon, authenticated;

create index post_mentions_user_idx on public.post_mentions (user_id);

create function public.post_hashtags_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.hashtags set post_count = post_count + 1 where id = new.hashtag_id;
  else
    update public.hashtags set post_count = greatest(post_count - 1, 0) where id = old.hashtag_id;
  end if;
  return null;
end;
$$;

create trigger post_hashtags_after_change
  after insert or delete on public.post_hashtags
  for each row execute function public.post_hashtags_after_change();

-- Re-parse #tags and @mentions of a published post.
create function public.sync_post_caption_refs(p_post uuid, p_caption text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hashtags (name)
  select distinct lower(m[1]) from regexp_matches(p_caption, '#([[:alnum:]_]{1,100})', 'g') m
  on conflict (name) do nothing;

  delete from public.post_hashtags ph
  where ph.post_id = p_post
    and ph.hashtag_id not in (
      select h.id from public.hashtags h
      where h.name in (
        select lower(m[1]) from regexp_matches(p_caption, '#([[:alnum:]_]{1,100})', 'g') m
      )
    );
  insert into public.post_hashtags (post_id, hashtag_id)
  select p_post, h.id from public.hashtags h
  where h.name in (
    select lower(m[1]) from regexp_matches(p_caption, '#([[:alnum:]_]{1,100})', 'g') m
  )
  on conflict do nothing;

  delete from public.post_mentions pm
  where pm.post_id = p_post
    and pm.user_id not in (
      select p.id from public.profiles p
      where p.username in (
        select lower(m[1]) from regexp_matches(p_caption, '@([A-Za-z0-9._]{1,30})', 'g') m
      )
    );
  insert into public.post_mentions (post_id, user_id)
  select p_post, p.id from public.profiles p
  where p.username in (
    select lower(m[1]) from regexp_matches(p_caption, '@([A-Za-z0-9._]{1,30})', 'g') m
  )
  on conflict do nothing;
end;
$$;

create function public.posts_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_posts_count(old.author_id);
    return null;
  end if;
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published' or new.caption is distinct from old.caption) then
    perform public.sync_post_caption_refs(new.id, new.caption);
  end if;
  if tg_op = 'INSERT' or old.status is distinct from new.status
     or old.archived_at is distinct from new.archived_at then
    perform public.refresh_posts_count(new.author_id);
  end if;
  return null;
end;
$$;

create trigger posts_after_change
  after insert or update or delete on public.posts
  for each row execute function public.posts_after_change();

-- ---------------------------------------------------------------------------------------------
-- Tag people (page 37)
-- ---------------------------------------------------------------------------------------------
create table public.post_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  media_id uuid not null references public.post_media (id) on delete cascade,
  tagged_user_id uuid not null references public.profiles (id) on delete cascade,
  -- Position on the slide as 0–1 fractions; null for video slides (listed, not placed).
  x real,
  y real,
  created_at timestamptz not null default now(),
  constraint post_tags_position check (
    (x is null and y is null) or (x between 0 and 1 and y between 0 and 1)
  ),
  constraint post_tags_unique unique (media_id, tagged_user_id)
);

create index post_tags_user_idx on public.post_tags (tagged_user_id, created_at desc);
create index post_tags_post_idx on public.post_tags (post_id);

alter table public.post_tags enable row level security;

create policy post_tags_select_visible on public.post_tags
  for select to authenticated using (public.can_view_post(post_id));
create policy post_tags_insert_author on public.post_tags
  for insert to authenticated
  with check (exists (
    select 1 from public.post_media m
    where m.id = media_id and m.post_id = post_tags.post_id and m.author_id = (select auth.uid())
  ));
create policy post_tags_update_author on public.post_tags
  for update to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
  ));
-- The author removes a tag, or the tagged person removes themselves.
create policy post_tags_delete_party on public.post_tags
  for delete to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

revoke update on public.post_tags from anon, authenticated;
grant update (x, y) on public.post_tags to authenticated;

create function public.post_tags_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(distinct tagged_user_id) from public.post_tags
      where post_id = new.post_id and tagged_user_id <> new.tagged_user_id) >= 20 then
    raise exception 'tag_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger post_tags_before_insert
  before insert on public.post_tags
  for each row execute function public.post_tags_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Collaborators (page 36): invite ≤5, the invitee accepts or declines
-- ---------------------------------------------------------------------------------------------

alter table public.post_collaborators enable row level security;

create policy post_collaborators_select_visible on public.post_collaborators
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
    )
    or (status = 'accepted' and public.can_view_post(post_id))
  );
create policy post_collaborators_insert_author on public.post_collaborators
  for insert to authenticated
  with check (
    status = 'pending'
    and user_id <> (select auth.uid())
    and exists (
      select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
    )
  );
-- The author removes a collaborator, or the collaborator declines / leaves.
create policy post_collaborators_delete_party on public.post_collaborators
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

revoke update on public.post_collaborators from anon, authenticated;
revoke insert on public.post_collaborators from anon, authenticated;
grant insert (post_id, user_id) on public.post_collaborators to authenticated;

create function public.post_collaborators_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.post_collaborators where post_id = new.post_id) >= 5 then
    raise exception 'collaborator_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger post_collaborators_before_insert
  before insert on public.post_collaborators
  for each row execute function public.post_collaborators_before_insert();

-- Accept (→ shown on both profiles) or decline (row removed).
create function public.respond_collab_invite(p_post uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.post_collaborators
    set status = 'accepted', responded_at = now()
    where post_id = p_post and user_id = auth.uid() and status = 'pending';
  else
    delete from public.post_collaborators
    where post_id = p_post and user_id = auth.uid() and status = 'pending';
  end if;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Page 40: publish once every file is in storage. Returns the published timestamp.
create function public.publish_post(p_post uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts;
  v_count integer;
  v_missing integer;
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

  select count(*) into v_missing
  from public.post_media m
  cross join lateral unnest(array[m.path, m.thumb_path]) as f(path)
  where m.post_id = p_post
    and f.path is not null
    and not exists (
      select 1 from storage.objects o where o.bucket_id = 'posts' and o.name = f.path
    );
  if v_missing > 0 then
    raise exception 'media_missing' using errcode = '22023';
  end if;

  update public.posts
  set status = 'published', published_at = now()
  where id = p_post;
  return now();
end;
$$;

-- Page 35/41: set the slide order (every slide id exactly once).
create function public.reorder_post_media(p_post uuid, p_media uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post and author_id = auth.uid()) then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;
  if (select array_agg(id order by id) from public.post_media where post_id = p_post)
     is distinct from (select array_agg(x order by x) from unnest(p_media) x) then
    raise exception 'media_mismatch' using errcode = '22023';
  end if;
  update public.post_media m
  set position = o.ord - 1
  from unnest(p_media) with ordinality as o(id, ord)
  where m.id = o.id and m.post_id = p_post;
end;
$$;

-- Profile grids (pages 16/17), Tagged tab and the posts archive (page 28, posts part).
-- kind: 'grid' (own + accepted collaborations, pinned first) | 'tagged' | 'archived' (own only).
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
  archived_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.author_id,
    coalesce(m.thumb_path, m.path) as cover_path,
    m.type as cover_type,
    (select count(*)::integer from public.post_media x where x.post_id = p.id) as media_count,
    p.audience,
    (p_kind = 'grid' and p.author_id = p_user and p.pinned_at is not null) as is_pinned,
    p.published_at,
    p.archived_at
  from public.posts p
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
      when 'tagged' then p.archived_at is null and exists (
        select 1 from public.post_tags t where t.post_id = p.id and t.tagged_user_id = p_user
      )
      when 'archived' then p.author_id = p_user and p_user = auth.uid() and p.archived_at is not null
      else false
    end
  order by
    (p_kind = 'grid' and p.author_id = p_user and p.pinned_at is not null) desc,
    case when p_kind = 'grid' and p.author_id = p_user then p.pinned_at end desc nulls last,
    case when p_kind = 'archived' then p.archived_at else p.published_at end desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- People search for @mentions, Tag people and collaborators: accounts I follow first.
create function public.search_profiles(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  is_private boolean,
  i_follow boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, p.is_private,
    exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    ) as i_follow
  from public.profiles p
  where trim(coalesce(p_query, '')) = ''
     or p.username like lower(trim(p_query)) || '%'
     or p.full_name ilike '%' || trim(p_query) || '%'
  order by
    exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id
    ) desc,
    (p.username = lower(trim(p_query))) desc,
    p.followers_count desc,
    p.username
  limit least(greatest(p_limit, 1), 50);
$$;

-- Pending collaboration invites for me (STUB inbox until Activity, page 71).
create function public.my_collab_invites()
returns table (
  post_id uuid,
  author_id uuid,
  author_username text,
  author_avatar_path text,
  cover_path text,
  invited_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.post_id, p.author_id, a.username, a.avatar_path,
    (select coalesce(m.thumb_path, m.path) from public.post_media m
     where m.post_id = p.id order by m.position limit 1),
    c.invited_at
  from public.post_collaborators c
  join public.posts p on p.id = c.post_id and p.status = 'published'
  join public.profiles a on a.id = p.author_id
  where c.user_id = auth.uid() and c.status = 'pending'
  order by c.invited_at desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- Saved collections (Phase 2) now point at real posts
-- ---------------------------------------------------------------------------------------------
alter table public.saved_collection_items
  add constraint saved_collection_items_post_fk
  foreign key (post_id) references public.posts (id) on delete cascade;
alter table public.saved_collections
  add constraint saved_collections_cover_post_fk
  foreign key (cover_post_id) references public.posts (id) on delete set null;
create index saved_collection_items_post_idx on public.saved_collection_items (post_id);
create index saved_collections_cover_post_idx on public.saved_collections (cover_post_id);
create index posts_audio_track_idx on public.posts (audio_track_id);
create index saved_audio_track_idx on public.saved_audio (track_id);
create index post_tags_media_idx on public.post_tags (media_id);
create index post_media_author_idx on public.post_media (author_id);

-- ---------------------------------------------------------------------------------------------
-- Reserve the new route names (/compose, /p/…, /archive already reserved)
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
      'about', 'accounts', 'admin', 'administrator', 'api', 'archive', 'compose', 'create', 'dev',
      'direct', 'explore', 'favorites', 'help', 'highlights', 'humans', 'instagram', 'legal',
      'login', 'logout', 'null', 'p', 'profile', 'qr', 'reel', 'reels', 'root', 'saved',
      'settings', 'signup', 'stories', 'support', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.is_valid_caption(text) from public, anon;
revoke execute on function public.can_view_post(uuid) from public, anon;
revoke execute on function public.can_view_post_object(text) from public, anon;
revoke execute on function public.post_media_before_change() from public, anon, authenticated;
revoke execute on function public.posts_before_update() from public, anon, authenticated;
revoke execute on function public.refresh_posts_count(uuid) from public, anon, authenticated;
revoke execute on function public.post_hashtags_after_change() from public, anon, authenticated;
revoke execute on function public.sync_post_caption_refs(uuid, text) from public, anon, authenticated;
revoke execute on function public.posts_after_change() from public, anon, authenticated;
revoke execute on function public.post_tags_before_insert() from public, anon, authenticated;
revoke execute on function public.post_collaborators_before_insert() from public, anon, authenticated;
revoke execute on function public.respond_collab_invite(uuid, boolean) from public, anon;
revoke execute on function public.publish_post(uuid) from public, anon;
revoke execute on function public.reorder_post_media(uuid, uuid[]) from public, anon;
revoke execute on function public.profile_posts(uuid, text, integer, integer) from public, anon;
revoke execute on function public.search_profiles(text, integer) from public, anon;
revoke execute on function public.my_collab_invites() from public, anon;

grant execute on function public.is_valid_caption(text) to authenticated;
grant execute on function public.can_view_post(uuid) to authenticated;
grant execute on function public.can_view_post_object(text) to authenticated;
grant execute on function public.respond_collab_invite(uuid, boolean) to authenticated;
grant execute on function public.publish_post(uuid) to authenticated;
grant execute on function public.reorder_post_media(uuid, uuid[]) to authenticated;
grant execute on function public.profile_posts(uuid, text, integer, integer) to authenticated;
grant execute on function public.search_profiles(text, integer) to authenticated;
grant execute on function public.my_collab_invites() to authenticated;
