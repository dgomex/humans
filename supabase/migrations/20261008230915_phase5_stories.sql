-- Phase 5 — Stories (pages 52–57, plus the page 25 highlight editor and the page 28 stories
-- archive). Decisions: docs/DECISIONS.md 2026-10-09.
--
-- * stories: one row per story. Files live in stories/{author}/{story}/…; `content` is the
--   overlay document (background, media placement, layout cells, boomerang frames, text,
--   drawings, stickers) rendered by the client. uploading → published via publish_story().
-- * can_view_story(): author, or published + can_view_profile(author) + not hidden from you +
--   Close Friends membership for CF stories + (younger than 24 h or in a highlight).
-- * story_stickers (interactive: poll, quiz, question, slider, countdown, add_yours) and
--   story_sticker_responses; quiz answers stay hidden from viewers until they answer.
-- * story_views (names visible to the author for 48 h), story_likes, story_replies (stored now;
--   Phase 9 turns them into DM messages), story_mentions.
-- * story_settings (replies, resharing posts to stories, save to archive), story_hidden_from.
-- * highlight_items + save_highlight(); empty highlights delete themselves.
-- * reports accept target_type 'story'.

-- ---------------------------------------------------------------------------------------------
-- Settings (page 55) and "Hide story from"
-- ---------------------------------------------------------------------------------------------
create table public.story_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  replies text not null default 'everyone',
  allow_resharing boolean not null default true,
  save_to_archive boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint story_settings_replies_valid check (replies in ('everyone', 'following', 'off'))
);

comment on column public.story_settings.allow_resharing is
  'Others may add your posts to their stories (post sticker).';

alter table public.story_settings enable row level security;
create policy story_settings_select_own on public.story_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy story_settings_insert_own on public.story_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy story_settings_update_own on public.story_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger story_settings_set_updated_at
  before update on public.story_settings
  for each row execute function public.set_updated_at();

create table public.story_hidden_from (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  hidden_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, hidden_id),
  constraint story_hidden_from_not_self check (owner_id <> hidden_id)
);

create index story_hidden_from_hidden_idx on public.story_hidden_from (hidden_id);

alter table public.story_hidden_from enable row level security;
create policy story_hidden_from_select_owner on public.story_hidden_from
  for select to authenticated using (owner_id = (select auth.uid()));
create policy story_hidden_from_insert_owner on public.story_hidden_from
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy story_hidden_from_delete_owner on public.story_hidden_from
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------------------------
-- Every file must sit in the story's own folder: {author}/{story}/…
create function public.story_files_scoped(p_author uuid, p_story uuid, p_files text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_files), 0) <= 24
    and not exists (
      select 1 from unnest(p_files) f
      where f is null
        or f not like p_author::text || '/' || p_story::text || '/%'
        or f like '%..%'
    );
$$;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'uploading',
  kind text not null,
  media_path text,
  thumb_path text,
  files text[] not null default '{}',
  width integer,
  height integer,
  duration_ms integer,
  content jsonb not null default '{}'::jsonb,
  audience text not null default 'everyone',
  audio_track_id uuid references public.audio_tracks (id) on delete set null,
  audio_start_ms integer not null default 0,
  reshared_post_id uuid references public.posts (id) on delete set null,
  keep_in_archive boolean not null default true,
  view_count integer not null default 0,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint stories_status_valid check (status in ('uploading', 'published')),
  constraint stories_kind_valid check (kind in ('photo', 'video', 'text', 'boomerang', 'layout')),
  constraint stories_audience_valid check (audience in ('everyone', 'close_friends')),
  constraint stories_files_scoped check (public.story_files_scoped(author_id, id, files)),
  constraint stories_media_in_files check (media_path is null or media_path = any (files)),
  constraint stories_thumb_in_files check (thumb_path is null or thumb_path = any (files)),
  constraint stories_media_required check (
    (kind in ('photo', 'video') and media_path is not null)
    or (kind = 'text' and media_path is null)
    or (kind in ('boomerang', 'layout') and cardinality(files) > 0)
  ),
  constraint stories_duration check (
    duration_ms is null or duration_ms between 1 and 60000
  ),
  constraint stories_content_valid check (
    jsonb_typeof(content) = 'object' and pg_column_size(content) < 65536
  ),
  constraint stories_audio_start check (audio_start_ms >= 0)
);

comment on table public.stories is
  'Page 52–57. Visible for 24 h after published_at (forever to the author / inside highlights).';
comment on column public.stories.content is
  'Client overlay document (v1): background, media transform, layout cells, boomerang frames, elements.';
comment on column public.stories.keep_in_archive is
  'Copied from story_settings.save_to_archive when published; false = purged after 24 h unless highlighted.';

create index stories_author_published_idx on public.stories (author_id, published_at desc)
  where status = 'published';
create index stories_published_idx on public.stories (published_at desc) where status = 'published';
create index stories_reshared_post_idx on public.stories (reshared_post_id)
  where reshared_post_id is not null;

create table public.highlight_items (
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (highlight_id, story_id)
);

create index highlight_items_story_idx on public.highlight_items (story_id);
create index highlight_items_order_idx on public.highlight_items (highlight_id, position);

-- Who may see a story. Security definer: RLS on stories/highlight_items calls it without recursion.
create function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stories s
    where s.id = p_story
      and (
        s.author_id = auth.uid()
        or (
          s.status = 'published'
          and public.can_view_profile(s.author_id)
          and not exists (
            select 1 from public.story_hidden_from h
            where h.owner_id = s.author_id and h.hidden_id = auth.uid()
          )
          and (
            s.audience = 'everyone'
            or exists (
              select 1 from public.close_friends cf
              where cf.owner_id = s.author_id and cf.friend_id = auth.uid()
            )
          )
          and (
            s.published_at > now() - interval '24 hours'
            or exists (select 1 from public.highlight_items hi where hi.story_id = s.id)
          )
        )
      )
  );
$$;

-- A story is "active" (in the tray, interactive) for 24 h after publishing.
create function public.story_is_active(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story and s.status = 'published'
      and s.published_at > now() - interval '24 hours'
  );
$$;

-- Storage object name stories/{author}/{story}/{file} → can_view_story(story). Bad names → false.
create function public.can_view_story_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[2]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_view_story(((storage.foldername(object_name))[2])::uuid)
    else false
  end;
$$;

create policy stories_select_viewer on storage.objects
  for select to authenticated
  using (bucket_id = 'stories' and public.can_view_story_object(name));

alter table public.stories enable row level security;

-- The author check is inline so `insert … returning` works (the definer helper reads the
-- statement's snapshot, which doesn't include the new row yet).
create policy stories_select_visible on public.stories
  for select to authenticated
  using (author_id = (select auth.uid()) or public.can_view_story(id));
create policy stories_insert_owner on public.stories
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'uploading');
create policy stories_delete_owner on public.stories
  for delete to authenticated using (author_id = (select auth.uid()));

-- Clients only insert (and delete); publishing goes through publish_story(). No updates.
revoke insert, update on public.stories from anon, authenticated;
grant insert (id, kind, media_path, thumb_path, files, width, height, duration_ms, content,
              audience, audio_track_id, audio_start_ms, reshared_post_id)
  on public.stories to authenticated;

-- Post sticker ("Add to story" from the share sheet): your own post, or a public, published,
-- non-archived Everyone post whose author allows resharing to stories.
create function public.stories_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'uploading';
  new.published_at := null;
  new.view_count := 0;
  new.like_count := 0;
  new.reply_count := 0;
  new.created_at := now();
  if new.reshared_post_id is not null and not exists (
    select 1
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.id = new.reshared_post_id
      and public.can_view_post(p.id)
      and (
        p.author_id = new.author_id
        or (
          p.status = 'published' and p.archived_at is null and p.audience = 'everyone'
          and not a.is_private
          and coalesce(
            (select ss.allow_resharing from public.story_settings ss where ss.user_id = p.author_id),
            true
          )
        )
      )
  ) then
    raise exception 'post_not_shareable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger stories_before_insert
  before insert on public.stories
  for each row execute function public.stories_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Interactive stickers (page 54) and responses (pages 52 / 56)
-- ---------------------------------------------------------------------------------------------
create function public.is_valid_story_sticker(p_type text, p_data jsonb, p_correct smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_data) = 'object'
    and pg_column_size(p_data) < 4096
    and case p_type
      when 'poll' then
        char_length(coalesce(p_data ->> 'question', '')) <= 120
        and jsonb_typeof(p_data -> 'options') = 'array'
        and jsonb_array_length(p_data -> 'options') between 2 and 4
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'options') o
          where jsonb_typeof(o) <> 'string' or char_length(o #>> '{}') not between 1 and 40
        )
        and p_correct is null
      when 'quiz' then
        char_length(coalesce(p_data ->> 'question', '')) <= 120
        and jsonb_typeof(p_data -> 'options') = 'array'
        and jsonb_array_length(p_data -> 'options') between 2 and 4
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'options') o
          where jsonb_typeof(o) <> 'string' or char_length(o #>> '{}') not between 1 and 40
        )
        and p_correct is not null
        and p_correct between 0 and jsonb_array_length(p_data -> 'options') - 1
      when 'question' then
        char_length(coalesce(p_data ->> 'prompt', '')) between 1 and 120 and p_correct is null
      when 'slider' then
        char_length(coalesce(p_data ->> 'question', '')) <= 120
        and char_length(coalesce(p_data ->> 'emoji', '')) between 1 and 16
        and p_correct is null
      when 'countdown' then
        char_length(coalesce(p_data ->> 'title', '')) between 1 and 40
        and coalesce(p_data ->> 'ends_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
        and p_correct is null
      when 'add_yours' then
        char_length(coalesce(p_data ->> 'prompt', '')) between 1 and 120 and p_correct is null
      else false
    end;
$$;

create table public.story_stickers (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  correct_option smallint,
  chain_id uuid,
  created_at timestamptz not null default now(),
  constraint story_stickers_type_valid check (
    type in ('poll', 'quiz', 'question', 'slider', 'countdown', 'add_yours')
  ),
  constraint story_stickers_valid check (public.is_valid_story_sticker(type, data, correct_option)),
  constraint story_stickers_chain check ((type = 'add_yours') = (chain_id is not null))
);

comment on column public.story_stickers.correct_option is
  'Quiz answer. Not selectable by clients (column grant); revealed by story_sticker_results().';
comment on column public.story_stickers.chain_id is
  'Add yours: the root sticker id of the chain (its own id for a new prompt).';

create index story_stickers_story_idx on public.story_stickers (story_id);
create index story_stickers_chain_idx on public.story_stickers (chain_id) where chain_id is not null;

alter table public.story_stickers enable row level security;
create policy story_stickers_select_visible on public.story_stickers
  for select to authenticated using (public.can_view_story(story_id));
create policy story_stickers_insert_owner on public.story_stickers
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid()) and s.status = 'uploading'
    )
  );

revoke select, insert, update on public.story_stickers from anon, authenticated;
grant select (id, story_id, author_id, type, data, chain_id, created_at)
  on public.story_stickers to authenticated;
grant insert (id, story_id, type, data, correct_option, chain_id)
  on public.story_stickers to authenticated;

-- One of each interactive type per story; an Add yours chain must point at a root you can see.
create function public.story_stickers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root public.story_stickers;
begin
  new.created_at := now();
  if exists (
    select 1 from public.story_stickers s where s.story_id = new.story_id and s.type = new.type
  ) then
    raise exception 'sticker_limit' using errcode = '22023';
  end if;
  if new.type = 'add_yours' and new.chain_id <> new.id then
    select * into v_root from public.story_stickers where id = new.chain_id;
    if not found or v_root.type <> 'add_yours' or v_root.chain_id <> v_root.id
       or not public.can_view_story(v_root.story_id) then
      raise exception 'chain_not_found' using errcode = 'P0002';
    end if;
    -- The prompt always follows the chain's root.
    new.data := jsonb_build_object('prompt', v_root.data ->> 'prompt');
  end if;
  if new.type = 'countdown' and (new.data ->> 'ends_at')::timestamptz <= now() then
    raise exception 'countdown_in_past' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger story_stickers_before_insert
  before insert on public.story_stickers
  for each row execute function public.story_stickers_before_insert();

create table public.story_sticker_responses (
  id uuid primary key default gen_random_uuid(),
  sticker_id uuid not null references public.story_stickers (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null,
  option smallint,
  value real,
  body text,
  created_at timestamptz not null default now(),
  constraint story_sticker_responses_value check (value is null or value between 0 and 1),
  constraint story_sticker_responses_body check (body is null or char_length(body) between 1 and 300)
);

-- One vote / answer / slide / reminder per person; questions accept several answers.
create unique index story_sticker_responses_once on public.story_sticker_responses (sticker_id, user_id)
  where type <> 'question';
create index story_sticker_responses_sticker_idx on public.story_sticker_responses (sticker_id, created_at desc);
create index story_sticker_responses_story_idx on public.story_sticker_responses (story_id, user_id);

alter table public.story_sticker_responses enable row level security;
create policy story_sticker_responses_select_party on public.story_sticker_responses
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );
create policy story_sticker_responses_insert_own on public.story_sticker_responses
  for insert to authenticated with check (user_id = (select auth.uid()));
-- Only a countdown reminder can be taken back.
create policy story_sticker_responses_delete_reminder on public.story_sticker_responses
  for delete to authenticated using (user_id = (select auth.uid()) and type = 'countdown');

revoke insert, update on public.story_sticker_responses from anon, authenticated;
-- story_id / type are overwritten by the trigger from the sticker.
grant insert (sticker_id, story_id, type, option, value, body)
  on public.story_sticker_responses to authenticated;

create function public.story_sticker_responses_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sticker public.story_stickers;
  v_author uuid;
  v_options integer;
begin
  select * into v_sticker from public.story_stickers where id = new.sticker_id;
  if not found or not public.can_view_story(v_sticker.story_id)
     or not public.story_is_active(v_sticker.story_id) then
    raise exception 'sticker_not_found' using errcode = 'P0002';
  end if;
  select author_id into v_author from public.stories where id = v_sticker.story_id;
  if v_author = new.user_id then
    raise exception 'own_story' using errcode = '22023';
  end if;
  new.story_id := v_sticker.story_id;
  new.type := v_sticker.type;
  new.created_at := now();
  v_options := coalesce(jsonb_array_length(v_sticker.data -> 'options'), 0);
  if v_sticker.type in ('poll', 'quiz') then
    if new.option is null or new.option not between 0 and v_options - 1 then
      raise exception 'invalid_option' using errcode = '22023';
    end if;
    new.value := null;
    new.body := null;
  elsif v_sticker.type = 'slider' then
    if new.value is null then
      raise exception 'invalid_value' using errcode = '22023';
    end if;
    new.option := null;
    new.body := null;
  elsif v_sticker.type = 'question' then
    if new.body is null or btrim(new.body) = '' then
      raise exception 'invalid_answer' using errcode = '22023';
    end if;
    new.option := null;
    new.value := null;
  elsif v_sticker.type = 'countdown' then
    new.option := null;
    new.value := null;
    new.body := null;
  else
    -- Add yours is answered by posting a story with the chain's sticker.
    raise exception 'not_answerable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger story_sticker_responses_before_insert
  before insert on public.story_sticker_responses
  for each row execute function public.story_sticker_responses_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Mentions (page 54). Read by Phase 8 for notifications.
-- ---------------------------------------------------------------------------------------------
create table public.story_mentions (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id),
  constraint story_mentions_not_self check (user_id <> author_id)
);

create index story_mentions_user_idx on public.story_mentions (user_id, created_at desc);

alter table public.story_mentions enable row level security;
create policy story_mentions_select_visible on public.story_mentions
  for select to authenticated using (public.can_view_story(story_id));
create policy story_mentions_insert_owner on public.story_mentions
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid()) and s.status = 'uploading'
    )
  );

revoke insert, update on public.story_mentions from anon, authenticated;
grant insert (story_id, user_id) on public.story_mentions to authenticated;

create function public.story_mentions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.story_mentions where story_id = new.story_id) >= 10 then
    raise exception 'mention_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger story_mentions_before_insert
  before insert on public.story_mentions
  for each row execute function public.story_mentions_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Views, likes, replies (pages 52 / 56)
-- ---------------------------------------------------------------------------------------------
create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index story_views_viewer_idx on public.story_views (viewer_id, story_id);

alter table public.story_views enable row level security;
-- Viewers see their own "seen" rows; the author sees names for 48 h after publishing.
create policy story_views_select_party on public.story_views
  for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
        and s.published_at > now() - interval '48 hours'
    )
  );
create policy story_views_insert_own on public.story_views
  for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and public.can_view_story(story_id)
    and not exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );

revoke insert, update on public.story_views from anon, authenticated;
grant insert (story_id) on public.story_views to authenticated;

create table public.story_likes (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index story_likes_user_idx on public.story_likes (user_id);

alter table public.story_likes enable row level security;
-- Private: only the liker and the story's author.
create policy story_likes_select_party on public.story_likes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );
create policy story_likes_insert_own on public.story_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_story(story_id)
    and public.story_is_active(story_id)
    and not exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );
create policy story_likes_delete_own on public.story_likes
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.story_likes from anon, authenticated;
grant insert (story_id) on public.story_likes to authenticated;

-- Replies follow the author's story_settings.replies: everyone / people they follow / off.
create function public.story_replies_allowed(p_author uuid, p_sender uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_author <> p_sender and case coalesce(
      (select ss.replies from public.story_settings ss where ss.user_id = p_author), 'everyone')
    when 'everyone' then true
    when 'following' then exists (
      select 1 from public.follows f where f.follower_id = p_author and f.following_id = p_sender
    )
    else false
  end;
$$;

create table public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  is_reaction boolean not null default false,
  created_at timestamptz not null default now(),
  constraint story_replies_body check (char_length(body) between 1 and 1000)
);

comment on table public.story_replies is
  'Story replies + quick reactions. Phase 9 (Direct) moves them into DM threads.';

create index story_replies_story_idx on public.story_replies (story_id, created_at desc);
create index story_replies_sender_idx on public.story_replies (sender_id, created_at desc);

alter table public.story_replies enable row level security;
create policy story_replies_select_party on public.story_replies
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid())
    )
  );
create policy story_replies_insert_own on public.story_replies
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_view_story(story_id)
    and public.story_is_active(story_id)
    and public.story_replies_allowed(
      (select s.author_id from public.stories s where s.id = story_id), (select auth.uid())
    )
  );
create policy story_replies_delete_own on public.story_replies
  for delete to authenticated using (sender_id = (select auth.uid()));

revoke insert, update on public.story_replies from anon, authenticated;
grant insert (story_id, body, is_reaction) on public.story_replies to authenticated;

-- Counters (author-only numbers) kept by triggers.
create function public.story_counters_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story uuid := coalesce(new.story_id, old.story_id);
  v_delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'story_views' then
    update public.stories set view_count = greatest(0, view_count + v_delta) where id = v_story;
  elsif tg_table_name = 'story_likes' then
    update public.stories set like_count = greatest(0, like_count + v_delta) where id = v_story;
  else
    update public.stories set reply_count = greatest(0, reply_count + v_delta) where id = v_story;
  end if;
  return null;
end;
$$;

create trigger story_views_after_change
  after insert or delete on public.story_views
  for each row execute function public.story_counters_after_change();
create trigger story_likes_after_change
  after insert or delete on public.story_likes
  for each row execute function public.story_counters_after_change();
create trigger story_replies_after_change
  after insert or delete on public.story_replies
  for each row execute function public.story_counters_after_change();

-- ---------------------------------------------------------------------------------------------
-- Highlights (pages 25 / 57)
-- ---------------------------------------------------------------------------------------------
alter table public.highlight_items enable row level security;

create policy highlight_items_select_visible on public.highlight_items
  for select to authenticated
  using (public.can_view_profile(owner_id) and public.can_view_story(story_id));
create policy highlight_items_insert_owner on public.highlight_items
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = (select auth.uid()) and s.status = 'published'
    )
  );
create policy highlight_items_update_owner on public.highlight_items
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy highlight_items_delete_owner on public.highlight_items
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke insert, update on public.highlight_items from anon, authenticated;
grant insert (highlight_id, story_id, position) on public.highlight_items to authenticated;
grant update (position) on public.highlight_items to authenticated;

create function public.highlight_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.added_at := now();
  if (select count(*) from public.highlight_items where highlight_id = new.highlight_id) >= 100 then
    raise exception 'highlight_full' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger highlight_items_before_insert
  before insert on public.highlight_items
  for each row execute function public.highlight_items_before_insert();

-- A highlight without stories disappears, like Instagram.
create function public.highlight_items_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.highlights h
  where h.id = old.highlight_id
    and not exists (select 1 from public.highlight_items i where i.highlight_id = h.id);
  return null;
end;
$$;

create trigger highlight_items_after_delete
  after delete on public.highlight_items
  for each row execute function public.highlight_items_after_delete();

-- Create (p_highlight null) or update a highlight: title, cover, ordered stories (≥ 1).
create function public.save_highlight(
  p_highlight uuid,
  p_title text,
  p_cover_path text,
  p_story_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_highlight, gen_random_uuid());
  v_story uuid;
  v_pos integer := 0;
begin
  if coalesce(cardinality(p_story_ids), 0) = 0 then
    raise exception 'no_stories' using errcode = '22023';
  end if;
  if p_highlight is null then
    insert into public.highlights (id, title, cover_path, position)
    values (
      v_id, coalesce(p_title, ''), p_cover_path,
      coalesce((select max(position) + 1 from public.highlights where owner_id = auth.uid()), 0)
    );
  else
    update public.highlights
    set title = coalesce(p_title, title), cover_path = p_cover_path
    where id = v_id and owner_id = auth.uid();
    if not found then
      raise exception 'highlight_not_found' using errcode = 'P0002';
    end if;
  end if;
  -- Add / reorder first, then drop removed items, so the highlight never empties mid-way.
  foreach v_story in array p_story_ids loop
    insert into public.highlight_items (highlight_id, story_id, position)
    values (v_id, v_story, v_pos)
    on conflict (highlight_id, story_id) do update set position = excluded.position;
    v_pos := v_pos + 1;
  end loop;
  delete from public.highlight_items
  where highlight_id = v_id and story_id <> all (p_story_ids);
  return v_id;
end;
$$;

-- Highlights of a profile that have at least one story visible to the caller (own: all).
create function public.profile_highlights(p_user uuid)
returns table (
  id uuid,
  title text,
  cover_path text,
  item_count integer,
  first_story_id uuid,
  first_thumb_path text,
  first_story_kind text,
  "position" integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.title, h.cover_path, v.item_count, v.first_story_id, v.first_thumb_path,
         v.first_story_kind, h.position
  from public.highlights h
  cross join lateral (
    select count(*)::integer as item_count,
           (array_agg(s.id order by hi.position, hi.added_at))[1] as first_story_id,
           (array_agg(coalesce(s.thumb_path, s.media_path) order by hi.position, hi.added_at))[1]
             as first_thumb_path,
           (array_agg(s.kind order by hi.position, hi.added_at))[1] as first_story_kind
    from public.highlight_items hi
    join public.stories s on s.id = hi.story_id
    where hi.highlight_id = h.id
  ) v
  where h.owner_id = p_user and v.item_count > 0
  order by h.position, h.created_at;
$$;

-- ---------------------------------------------------------------------------------------------
-- Publishing (page 54/55)
-- ---------------------------------------------------------------------------------------------
create function public.publish_story(p_story uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story public.stories;
  v_missing integer;
begin
  select * into v_story from public.stories where id = p_story for update;
  if not found or v_story.author_id <> auth.uid() then
    raise exception 'story_not_found' using errcode = 'P0002';
  end if;
  if v_story.status = 'published' then
    return v_story.published_at;
  end if;
  select count(*) into v_missing
  from unnest(v_story.files) f(path)
  where not exists (
    select 1 from storage.objects o where o.bucket_id = 'stories' and o.name = f.path
  );
  if v_missing > 0 then
    raise exception 'media_missing' using errcode = '22023';
  end if;
  update public.stories
  set status = 'published',
      published_at = now(),
      keep_in_archive = coalesce(
        (select ss.save_to_archive from public.story_settings ss where ss.user_id = auth.uid()),
        true
      )
  where id = p_story;
  return now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------
-- Ring state for avatars (tray, profiles): active stories visible to the caller.
create function public.story_rings(p_users uuid[])
returns table (
  user_id uuid,
  story_count integer,
  has_unseen boolean,
  has_close_friends boolean,
  latest_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.author_id,
         count(*)::integer,
         bool_or(s.author_id <> auth.uid() and not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()
         )),
         bool_or(s.audience = 'close_friends'),
         max(s.published_at)
  from public.stories s
  where s.author_id = any (p_users)
    and s.status = 'published'
    and s.published_at > now() - interval '24 hours'
  group by s.author_id;
$$;

-- Page 43 tray: you, then people you follow with active stories (unseen first, Favorites and
-- Close Friends lists boosted, newest first).
create function public.stories_tray()
returns table (
  user_id uuid,
  username text,
  avatar_path text,
  story_count integer,
  has_unseen boolean,
  has_close_friends boolean,
  latest_at timestamptz,
  is_own boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.avatar_path, r.story_count, r.has_unseen, r.has_close_friends,
         r.latest_at, p.id = auth.uid()
  from public.story_rings(array(
         select auth.uid()
         union all
         select f.following_id from public.follows f where f.follower_id = auth.uid()
       )) r
  join public.profiles p on p.id = r.user_id
  order by p.id = auth.uid() desc,
           r.has_unseen desc,
           exists (select 1 from public.favorites fv
                   where fv.owner_id = auth.uid() and fv.favorite_id = p.id) desc,
           r.latest_at desc
  limit 100;
$$;

-- Results of one sticker for the caller. Viewers get aggregates once they answered (polls,
-- quizzes, sliders); the author gets everything. Quiz answers are revealed only then.
create function public.story_sticker_results(p_sticker uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sticker public.story_stickers;
  v_is_author boolean;
  v_answered boolean;
  v_total integer;
begin
  select * into v_sticker from public.story_stickers where id = p_sticker;
  if not found or not public.can_view_story(v_sticker.story_id) then
    return null;
  end if;
  v_is_author := v_sticker.author_id = auth.uid();
  v_answered := exists (
    select 1 from public.story_sticker_responses r
    where r.sticker_id = p_sticker and r.user_id = auth.uid()
  );
  select count(*) into v_total from public.story_sticker_responses r where r.sticker_id = p_sticker;

  if v_sticker.type = 'add_yours' then
    return jsonb_build_object(
      'participants', (
        select count(distinct st.author_id) from public.story_stickers k
        join public.stories st on st.id = k.story_id
        where k.chain_id = v_sticker.chain_id and st.status = 'published'
      )
    );
  end if;
  if not v_is_author and not v_answered then
    return null;
  end if;
  if v_sticker.type in ('poll', 'quiz') then
    return jsonb_build_object(
      'total', v_total,
      'counts', (
        select jsonb_agg(
          (select count(*) from public.story_sticker_responses r
           where r.sticker_id = p_sticker and r.option = o.i - 1)
          order by o.i)
        from generate_series(1, jsonb_array_length(v_sticker.data -> 'options')) o(i)
      ),
      'correct', case when v_sticker.type = 'quiz' then v_sticker.correct_option end
    );
  elsif v_sticker.type = 'slider' then
    return jsonb_build_object(
      'total', v_total,
      'average', (select avg(r.value) from public.story_sticker_responses r
                  where r.sticker_id = p_sticker)
    );
  elsif v_is_author then
    return jsonb_build_object('total', v_total);
  end if;
  return null;
end;
$$;

-- Story payloads in input order (only stories the caller can see). Used by the viewer (52),
-- highlights (57), archive (28) and the viewers sheet (56).
create function public.story_cards(p_ids uuid[])
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'author', jsonb_build_object(
      'id', a.id, 'username', a.username, 'avatar_path', a.avatar_path,
      'is_private', a.is_private
    ),
    'kind', s.kind,
    'media_path', s.media_path,
    'thumb_path', s.thumb_path,
    'width', s.width,
    'height', s.height,
    'duration_ms', s.duration_ms,
    'content', s.content,
    'audience', s.audience,
    'published_at', s.published_at,
    'is_active', s.published_at > now() - interval '24 hours',
    'is_own', s.author_id = auth.uid(),
    'audio_start_ms', s.audio_start_ms,
    'audio', (
      select jsonb_build_object(
        'id', t.id, 'title', t.title, 'artist', t.artist,
        'audio_path', t.audio_path, 'duration_ms', t.duration_ms, 'cover_color', t.cover_color
      )
      from public.audio_tracks t where t.id = s.audio_track_id
    ),
    'reshared_post_id', s.reshared_post_id,
    'seen', s.author_id = auth.uid() or exists (
      select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()
    ),
    'liked', exists (
      select 1 from public.story_likes l where l.story_id = s.id and l.user_id = auth.uid()
    ),
    'replies_allowed', public.story_replies_allowed(s.author_id, auth.uid()),
    'view_count', case when s.author_id = auth.uid() then s.view_count end,
    'like_count', case when s.author_id = auth.uid() then s.like_count end,
    'reply_count', case when s.author_id = auth.uid() then s.reply_count end,
    'highlight_ids', case when s.author_id = auth.uid() then coalesce((
      select jsonb_agg(hi.highlight_id) from public.highlight_items hi where hi.story_id = s.id
    ), '[]'::jsonb) end,
    'mentions', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.user_id, 'username', mp.username))
      from public.story_mentions m join public.profiles mp on mp.id = m.user_id
      where m.story_id = s.id
    ), '[]'::jsonb),
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'type', k.type, 'data', k.data, 'chain_id', k.chain_id,
        'mine', (
          select jsonb_agg(jsonb_build_object('option', r.option, 'value', r.value, 'body', r.body)
                           order by r.created_at)
          from public.story_sticker_responses r
          where r.sticker_id = k.id and r.user_id = auth.uid()
        ),
        'results', public.story_sticker_results(k.id)
      ) order by k.created_at)
      from public.story_stickers k where k.story_id = s.id
    ), '[]'::jsonb)
  )
  from unnest(p_ids) with ordinality as ids(id, ord)
  join public.stories s on s.id = ids.id
  join public.profiles a on a.id = s.author_id
  where s.status = 'published' or s.author_id = auth.uid()
  order by ids.ord;
$$;

-- Active stories of one user, oldest first (the viewer starts at the first unseen one).
create function public.story_reel(p_user uuid)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.story_cards(array(
    select s.id from public.stories s
    where s.author_id = p_user and s.status = 'published'
      and s.published_at > now() - interval '24 hours'
    order by s.published_at
  ));
$$;

create function public.highlight_reel(p_highlight uuid)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.story_cards(array(
    select hi.story_id from public.highlight_items hi
    where hi.highlight_id = p_highlight
    order by hi.position, hi.added_at
  ));
$$;

create function public.mark_stories_viewed(p_ids uuid[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.story_views (story_id)
  select s.id from public.stories s
  where s.id = any (p_ids) and s.author_id <> auth.uid() and s.status = 'published'
  on conflict (story_id, viewer_id) do nothing;
$$;

-- Page 56: viewers of your story (names for 48 h), ranked by interaction.
create function public.story_viewers(
  p_story uuid,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_path text,
  viewed_at timestamptz,
  liked boolean,
  reply text,
  reply_is_reaction boolean,
  responses jsonb,
  i_follow boolean,
  follows_me boolean,
  is_hidden boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, v.viewed_at, x.liked,
         x.reply, x.reply_is_reaction, x.responses, x.i_follow, x.follows_me,
         exists (select 1 from public.story_hidden_from h
                 where h.owner_id = auth.uid() and h.hidden_id = p.id)
  from public.story_views v
  join public.stories s on s.id = v.story_id and s.author_id = auth.uid()
  join public.profiles p on p.id = v.viewer_id
  cross join lateral (
    select
      exists (select 1 from public.story_likes l
              where l.story_id = s.id and l.user_id = p.id) as liked,
      (select r.body from public.story_replies r
       where r.story_id = s.id and r.sender_id = p.id order by r.created_at desc limit 1) as reply,
      (select r.is_reaction from public.story_replies r
       where r.story_id = s.id and r.sender_id = p.id order by r.created_at desc limit 1)
        as reply_is_reaction,
      (select jsonb_agg(jsonb_build_object('type', r.type, 'option', r.option,
                                           'value', r.value, 'body', r.body))
       from public.story_sticker_responses r
       where r.story_id = s.id and r.user_id = p.id) as responses,
      exists (select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.id) as i_follow,
      exists (select 1 from public.follows f
              where f.follower_id = p.id and f.following_id = auth.uid()) as follows_me,
      exists (select 1 from public.close_friends cf
              where cf.owner_id = auth.uid() and cf.friend_id = p.id) as close_friend,
      exists (select 1 from public.favorites fv
              where fv.owner_id = auth.uid() and fv.favorite_id = p.id) as favorite
  ) x
  where v.story_id = p_story
    and (coalesce(p_search, '') = ''
         or p.username ilike '%' || p_search || '%'
         or p.full_name ilike '%' || p_search || '%')
  order by
    (x.liked::int * 3 + (x.reply is not null)::int * 3 + (x.responses is not null)::int * 2
     + x.close_friend::int * 2 + x.favorite::int * 2
     + (x.i_follow and x.follows_me)::int) desc,
    v.viewed_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

-- Page 56: every sticker response on your story (poll voters, question answers, …).
create function public.story_responses(p_story uuid)
returns table (
  id uuid,
  sticker_id uuid,
  type text,
  option smallint,
  value real,
  body text,
  created_at timestamptz,
  user_id uuid,
  username text,
  avatar_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.sticker_id, r.type, r.option, r.value, r.body, r.created_at,
         p.id, p.username, p.avatar_path
  from public.story_sticker_responses r
  join public.stories s on s.id = r.story_id and s.author_id = auth.uid()
  join public.profiles p on p.id = r.user_id
  where r.story_id = p_story
  order by r.created_at desc
  limit 500;
$$;

-- Add yours: stories in a chain that the caller can see (active ones first).
create function public.add_yours_chain(p_chain uuid, p_offset integer default 0, p_limit integer default 30)
returns table (
  story_id uuid,
  user_id uuid,
  username text,
  avatar_path text,
  thumb_path text,
  kind text,
  published_at timestamptz,
  is_active boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, p.id, p.username, p.avatar_path, coalesce(s.thumb_path, s.media_path), s.kind,
         s.published_at, s.published_at > now() - interval '24 hours'
  from public.story_stickers k
  join public.stories s on s.id = k.story_id and s.status = 'published'
  join public.profiles p on p.id = s.author_id
  where k.chain_id = p_chain
  order by (s.published_at > now() - interval '24 hours') desc, s.published_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- Page 28 (stories part): your stories archive, newest first.
create function public.story_archive(p_offset integer default 0, p_limit integer default 60)
returns table (
  id uuid,
  kind text,
  media_path text,
  thumb_path text,
  content jsonb,
  width integer,
  height integer,
  audience text,
  published_at timestamptz,
  is_active boolean,
  in_highlight boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.kind, s.media_path, s.thumb_path, s.content, s.width, s.height, s.audience,
         s.published_at, s.published_at > now() - interval '24 hours',
         exists (select 1 from public.highlight_items hi where hi.story_id = s.id)
  from public.stories s
  where s.author_id = auth.uid() and s.status = 'published'
    and (s.keep_in_archive
         or s.published_at > now() - interval '24 hours'
         or exists (select 1 from public.highlight_items hi where hi.story_id = s.id))
  order by s.published_at desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 120);
$$;

-- Own expired stories that aren't archived or highlighted (the client deletes their files and
-- rows on launch), plus abandoned uploads older than a day.
create function public.my_purgeable_stories()
returns table (id uuid, files text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.files
  from public.stories s
  where s.author_id = auth.uid()
    and (
      (s.status = 'published' and not s.keep_in_archive
       and s.published_at <= now() - interval '24 hours'
       and not exists (select 1 from public.highlight_items hi where hi.story_id = s.id))
      or (s.status = 'uploading' and s.created_at <= now() - interval '24 hours')
    )
  limit 100;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports: stories can be reported (page 52 ⋯ → page 50 flow)
-- ---------------------------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_valid;
alter table public.reports add constraint reports_target_type_valid
  check (target_type in ('post', 'comment', 'profile', 'story'));

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
-- Reserve the new route names (/story/…)
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
      'direct', 'explore', 'favorites', 'feed', 'help', 'highlights', 'humans', 'instagram',
      'legal', 'login', 'logout', 'null', 'p', 'profile', 'qr', 'reel', 'reels', 'report', 'root',
      'saved', 'settings', 'signup', 'stories', 'story', 'support', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.stories_before_insert() from public, anon, authenticated;
revoke execute on function public.story_stickers_before_insert() from public, anon, authenticated;
revoke execute on function public.story_sticker_responses_before_insert() from public, anon, authenticated;
revoke execute on function public.story_mentions_before_insert() from public, anon, authenticated;
revoke execute on function public.story_counters_after_change() from public, anon, authenticated;
revoke execute on function public.highlight_items_before_insert() from public, anon, authenticated;
revoke execute on function public.highlight_items_after_delete() from public, anon, authenticated;

revoke execute on function public.story_files_scoped(uuid, uuid, text[]) from public, anon;
revoke execute on function public.is_valid_story_sticker(text, jsonb, smallint) from public, anon;
revoke execute on function public.can_view_story(uuid) from public, anon;
revoke execute on function public.can_view_story_object(text) from public, anon;
revoke execute on function public.story_is_active(uuid) from public, anon;
revoke execute on function public.story_replies_allowed(uuid, uuid) from public, anon;
revoke execute on function public.save_highlight(uuid, text, text, uuid[]) from public, anon;
revoke execute on function public.profile_highlights(uuid) from public, anon;
revoke execute on function public.publish_story(uuid) from public, anon;
revoke execute on function public.story_rings(uuid[]) from public, anon;
revoke execute on function public.stories_tray() from public, anon;
revoke execute on function public.story_sticker_results(uuid) from public, anon;
revoke execute on function public.story_cards(uuid[]) from public, anon;
revoke execute on function public.story_reel(uuid) from public, anon;
revoke execute on function public.highlight_reel(uuid) from public, anon;
revoke execute on function public.mark_stories_viewed(uuid[]) from public, anon;
revoke execute on function public.story_viewers(uuid, text, integer, integer) from public, anon;
revoke execute on function public.story_responses(uuid) from public, anon;
revoke execute on function public.add_yours_chain(uuid, integer, integer) from public, anon;
revoke execute on function public.story_archive(integer, integer) from public, anon;
revoke execute on function public.my_purgeable_stories() from public, anon;

grant execute on function public.story_files_scoped(uuid, uuid, text[]) to authenticated;
grant execute on function public.is_valid_story_sticker(text, jsonb, smallint) to authenticated;
grant execute on function public.can_view_story(uuid) to authenticated;
grant execute on function public.can_view_story_object(text) to authenticated;
grant execute on function public.story_is_active(uuid) to authenticated;
grant execute on function public.story_replies_allowed(uuid, uuid) to authenticated;
grant execute on function public.save_highlight(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.profile_highlights(uuid) to authenticated;
grant execute on function public.publish_story(uuid) to authenticated;
grant execute on function public.story_rings(uuid[]) to authenticated;
grant execute on function public.stories_tray() to authenticated;
grant execute on function public.story_sticker_results(uuid) to authenticated;
grant execute on function public.story_cards(uuid[]) to authenticated;
grant execute on function public.story_reel(uuid) to authenticated;
grant execute on function public.highlight_reel(uuid) to authenticated;
grant execute on function public.mark_stories_viewed(uuid[]) to authenticated;
grant execute on function public.story_viewers(uuid, text, integer, integer) to authenticated;
grant execute on function public.story_responses(uuid) to authenticated;
grant execute on function public.add_yours_chain(uuid, integer, integer) to authenticated;
grant execute on function public.story_archive(integer, integer) to authenticated;
grant execute on function public.my_purgeable_stories() to authenticated;
