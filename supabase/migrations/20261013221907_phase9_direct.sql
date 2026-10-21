-- Phase 9 — Direct Messages (pages 74–81; page 82 calls deferred by decision 2026-10-13)
-- * threads (direct = one per pair via direct_key, group ≤ 250), thread_members (status active /
--   request / hidden / left, personal state: last read, receipts, mute, pin, cleared, nickname),
--   thread_join_requests (Approve new members).
-- * messages (text / media / voice / shared post · story · profile · audio / system lines), reactions,
--   view-once views. Clients insert messages directly (column grants + validating trigger); every
--   other change goes through RPCs. Scheduled messages are delivered by pg_cron.
-- * notes + note_likes (page 81), user_presence (active status).
-- * Realtime: triggers broadcast to private topics `thread:{id}` (open chats) and `inbox:{user}`
--   (inbox + ✈ badge); typing is sent by clients on `thread:{id}`. Access via realtime.messages RLS.
-- * Story replies (Phase 5 `story_replies`) now also land in the 1:1 thread with the story author.

-- ---------------------------------------------------------------------------------------------
-- Notes (page 81)
-- ---------------------------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text,
  audio_track_id uuid references public.audio_tracks (id) on delete cascade,
  audio_start_ms integer not null default 0,
  audience text not null default 'mutuals',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint notes_body check (body is null or char_length(body) between 1 and 60),
  constraint notes_content check (body is not null or audio_track_id is not null),
  constraint notes_audience check (audience in ('mutuals', 'close_friends')),
  constraint notes_audio_start check (audio_start_ms >= 0)
);

comment on table public.notes is
  'Notes (page 81): ≤60 chars and/or a song, 24 h, one active per author. Mutuals or Close Friends.';

create index notes_author_idx on public.notes (author_id, created_at desc);
create index notes_audio_idx on public.notes (audio_track_id) where audio_track_id is not null;

create table public.note_likes (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index note_likes_user_idx on public.note_likes (user_id);

-- ---------------------------------------------------------------------------------------------
-- Threads + members
-- ---------------------------------------------------------------------------------------------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  created_by uuid references public.profiles (id) on delete set null,
  direct_key text unique,
  title text,
  photo_path text,
  theme text not null default 'default',
  approval_required boolean not null default false,
  invite_token text unique,
  vanish_mode boolean not null default false,
  last_message_at timestamptz,
  last_message_id uuid,
  created_at timestamptz not null default now(),
  constraint threads_kind check (kind in ('direct', 'group')),
  constraint threads_direct_key check ((kind = 'direct') = (direct_key is not null)),
  constraint threads_title check (title is null or char_length(title) between 1 and 100),
  constraint threads_group_only check (
    kind = 'group' or (title is null and photo_path is null and invite_token is null
                       and not approval_required)
  ),
  constraint threads_vanish_direct check (kind = 'direct' or not vanish_mode),
  constraint threads_theme check (theme in (
    'default', 'berry', 'ocean', 'sunset', 'forest', 'lavender', 'candy', 'midnight', 'fire', 'mono'
  ))
);

comment on table public.threads is
  'DM threads (pages 74–79). Written only by RPCs / triggers; members read their threads.';

create table public.thread_members (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  added_by uuid references public.profiles (id) on delete set null,
  joined_via text not null default 'added',
  joined_at timestamptz not null default now(),
  accepted_at timestamptz,
  left_at timestamptz,
  last_read_at timestamptz not null default now(),
  read_receipts boolean not null default true,
  muted_until timestamptz,
  pinned_at timestamptz,
  marked_unread boolean not null default false,
  cleared_at timestamptz,
  nickname text,
  primary key (thread_id, user_id),
  constraint thread_members_role check (role in ('admin', 'member')),
  constraint thread_members_status check (status in ('active', 'request', 'hidden', 'left')),
  constraint thread_members_joined_via check (joined_via in ('created', 'added', 'invite')),
  constraint thread_members_nickname check (nickname is null or char_length(nickname) between 1 and 50)
);

comment on table public.thread_members is
  'Membership + personal chat state. Clients read their own rows; others via thread_info().';

create index thread_members_user_idx on public.thread_members (user_id, status);
create index thread_members_added_by_idx on public.thread_members (added_by) where added_by is not null;

create table public.thread_join_requests (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index thread_join_requests_user_idx on public.thread_join_requests (user_id);
create index thread_join_requests_added_by_idx on public.thread_join_requests (added_by)
  where added_by is not null;

-- ---------------------------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'text',
  body text,
  reply_to_id uuid references public.messages (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  story_id uuid references public.stories (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  audio_id uuid references public.audio_tracks (id) on delete set null,
  note_id uuid references public.notes (id) on delete set null,
  media_type text,
  media_path text,
  thumb_path text,
  width integer,
  height integer,
  duration_ms integer,
  waveform jsonb,
  view_mode text not null default 'keep',
  data jsonb not null default '{}'::jsonb,
  vanish boolean not null default false,
  pinned_at timestamptz,
  pinned_by uuid references public.profiles (id) on delete set null,
  edited_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_kind check (kind in (
    'text', 'media', 'voice', 'post', 'story', 'profile', 'audio', 'system'
  )),
  constraint messages_body check (body is null or char_length(body) between 1 and 1000),
  constraint messages_media_type check (media_type is null or media_type in ('image', 'video', 'audio')),
  constraint messages_view_mode check (view_mode in ('keep', 'once', 'replay')),
  constraint messages_waveform check (
    waveform is null or (jsonb_typeof(waveform) = 'array' and jsonb_array_length(waveform) <= 100)
  )
);

comment on table public.messages is
  'DM messages (page 76). Insert own (validated by messages_before_insert); unsend = delete own; '
  'edit / pin via RPCs; system lines written by RPCs.';

create index messages_thread_idx on public.messages (thread_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);
create index messages_reply_to_idx on public.messages (reply_to_id) where reply_to_id is not null;
create index messages_post_idx on public.messages (post_id) where post_id is not null;
create index messages_story_idx on public.messages (story_id) where story_id is not null;
create index messages_profile_idx on public.messages (profile_id) where profile_id is not null;
create index messages_audio_idx on public.messages (audio_id) where audio_id is not null;
create index messages_note_idx on public.messages (note_id) where note_id is not null;
create index messages_pinned_by_idx on public.messages (pinned_by) where pinned_by is not null;
create index messages_scheduled_idx on public.messages (scheduled_for) where scheduled_for is not null;

alter table public.threads
  add constraint threads_last_message_fk foreign key (last_message_id)
  references public.messages (id) on delete set null;
create index threads_last_message_idx on public.threads (last_message_id)
  where last_message_id is not null;

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji check (char_length(emoji) between 1 and 16)
);

create index message_reactions_user_idx on public.message_reactions (user_id);

-- View-once / replay media (page 80): one row per viewer.
create table public.message_views (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  view_count smallint not null default 0,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  screenshot_at timestamptz,
  primary key (message_id, user_id)
);

create index message_views_user_idx on public.message_views (user_id);

-- Active status ("Active now", "Active 2h ago").
create table public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_active_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create function public.direct_key(a uuid, b uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select least(a, b)::text || ':' || greatest(a, b)::text;
$$;

-- My membership status in a thread (null = not a member).
create function public.my_thread_status(p_thread uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.status from public.thread_members m
  where m.thread_id = p_thread and m.user_id = auth.uid();
$$;

-- Whether I can read a message: scheduled ones only by their sender; otherwise members, from
-- when they joined, after "Delete chat" (cleared_at), and until they left.
create function public.can_read_message(
  p_thread uuid, p_sender uuid, p_created timestamptz, p_scheduled timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_scheduled is not null then p_sender = auth.uid()
    else exists (
      select 1 from public.thread_members m
      where m.thread_id = p_thread and m.user_id = auth.uid()
        and p_created >= m.joined_at
        and (m.cleared_at is null or p_created > m.cleared_at)
        and (m.status <> 'left' or p_created <= m.left_at)
    )
  end;
$$;

-- Built-in filter for Hidden requests (page 75); personal Hidden words arrive with page 95.
create function public.is_flagged_text(p_body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_body, '') ~* (
    '(\mfree followers\M|\mbuy followers\M|\mcrypto giveaway\M|\mclick (this|my) link\M'
    || '|\mcash app\M|\mwire transfer\M|\msend nudes\M|\mfuck(ing|er)?\M|\mbitch(es)?\M'
    || '|\mshit\M|\mwhore\M|\mslut\M|\mkill yourself\M|\mkys\M)'
  );
$$;

-- Note visibility: author, or unexpired + (mutual follow | author's Close Friends).
create function public.can_view_note(p_note uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note
      and (
        n.author_id = auth.uid()
        or (
          n.expires_at > now()
          and case n.audience
            when 'close_friends' then exists (
              select 1 from public.close_friends cf
              where cf.owner_id = n.author_id and cf.friend_id = auth.uid()
            )
            else exists (
              select 1 from public.follows f
              where f.follower_id = n.author_id and f.following_id = auth.uid()
            ) and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = n.author_id
            )
          end
        )
      )
  );
$$;

-- Storage messages/{thread}/{message_id}.{ext} | {message_id}-thumb.jpg | group-{uuid}.jpg.
-- Uploaders always read their own objects (owner policy below).
create function public.can_view_message_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_thread uuid;
  v_file text := storage.filename(object_name);
  v_msg public.messages;
  v_uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if (storage.foldername(object_name))[1] !~ ('^' || v_uuid || '$') then
    return false;
  end if;
  v_thread := ((storage.foldername(object_name))[1])::uuid;
  if v_file like 'group-%' then
    return coalesce(public.my_thread_status(v_thread), 'left') <> 'left';
  end if;
  if v_file !~ ('^' || v_uuid) then
    return false;
  end if;
  select * into v_msg from public.messages
  where id = (substring(v_file from ('^(' || v_uuid || ')')))::uuid and thread_id = v_thread;
  if v_msg.id is null
     or not public.can_read_message(v_msg.thread_id, v_msg.sender_id, v_msg.created_at,
                                    v_msg.scheduled_for) then
    return false;
  end if;
  if v_msg.sender_id = auth.uid() or v_msg.view_mode = 'keep' then
    return true;
  end if;
  -- View-once / replay: only right after open_message_media() registered the view.
  return exists (
    select 1 from public.message_views v
    where v.message_id = v_msg.id and v.user_id = auth.uid()
      and v.last_viewed_at > now() - interval '5 minutes'
  );
end;
$$;

-- realtime topic "thread:{uuid}" → am I a (non-left) member? Active only when p_active.
create function public.realtime_thread_member(p_topic text, p_active boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^thread:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (
        select 1 from public.thread_members m
        where m.thread_id = substring(p_topic from 8)::uuid and m.user_id = auth.uid()
          and (m.status = 'active' or (not p_active and m.status <> 'left'))
      )
    else false
  end;
$$;

-- Broadcast a change to open chats (thread:{id}) and to every member's inbox (inbox:{user}).
-- Failures never block the write.
create function public.thread_broadcast(p_thread uuid, p_event text, p_payload jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('thread_id', p_thread, 'event', p_event);
  v_user uuid;
begin
  perform realtime.send(v_payload, p_event, 'thread:' || p_thread::text, true);
  for v_user in
    select m.user_id from public.thread_members m
    where m.thread_id = p_thread and m.status <> 'left'
  loop
    perform realtime.send(v_payload, 'inbox', 'inbox:' || v_user::text, true);
  end loop;
exception when others then
  null;
end;
$$;

-- System line ("x named the group…"). Inserted by definer RPCs, bypassing client RLS.
create function public.add_system_message(
  p_thread uuid, p_actor uuid, p_event text, p_data jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.messages (thread_id, sender_id, kind, data)
  values (p_thread, p_actor, 'system', jsonb_build_object('event', p_event) || coalesce(p_data, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;

-- One 1:1 thread per pair. The other person lands in Requests unless they follow me.
create function public.ensure_direct_thread(p_me uuid, p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := public.direct_key(p_me, p_other);
  v_thread uuid;
begin
  select id into v_thread from public.threads where direct_key = v_key;
  if v_thread is not null then
    return v_thread;
  end if;
  insert into public.threads (kind, created_by, direct_key)
  values ('direct', p_me, v_key)
  on conflict (direct_key) do nothing
  returning id into v_thread;
  if v_thread is null then
    select id into v_thread from public.threads where direct_key = v_key;
    return v_thread;
  end if;
  insert into public.thread_members (thread_id, user_id, status, added_by, joined_via, accepted_at)
  values (v_thread, p_me, 'active', p_me, 'created', now());
  insert into public.thread_members (thread_id, user_id, status, added_by, joined_via, accepted_at)
  select v_thread, p_other, s.status, p_me, 'created', case when s.status = 'active' then now() end
  from (
    select case when exists (
      select 1 from public.follows f where f.follower_id = p_other and f.following_id = p_me
    ) then 'active' else 'request' end as status
  ) s;
  return v_thread;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Message triggers
-- ---------------------------------------------------------------------------------------------
create function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_thread public.threads;
  v_status text;
  v_other_status text;
  v_prefix text;
  v_story_author uuid;
  v_note public.notes;
begin
  if new.kind = 'system' then
    new.created_at := now();
    return new;
  end if;
  -- Service role / migrations (no user) are trusted.
  if v_me is null then
    return new;
  end if;

  new.sender_id := v_me;
  new.created_at := now();
  new.pinned_at := null;
  new.pinned_by := null;
  new.edited_at := null;

  select * into v_thread from public.threads where id = new.thread_id;
  select status into v_status from public.thread_members
  where thread_id = new.thread_id and user_id = v_me;
  if v_thread.id is null or v_status is null or v_status = 'left' then
    raise exception 'not_member' using errcode = '42501';
  end if;

  -- Message requests (page 75): one text-only message until the other person accepts.
  -- Story replies are tied to a story the author showed you and skip the limit.
  if v_thread.kind = 'direct' then
    select status into v_other_status from public.thread_members
    where thread_id = new.thread_id and user_id <> v_me;
    if v_other_status in ('request', 'hidden') and new.story_id is null then
      if new.kind <> 'text' or new.scheduled_for is not null then
        raise exception 'request_text_only' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.messages m
        where m.thread_id = new.thread_id and m.sender_id = v_me and m.kind <> 'system'
      ) then
        raise exception 'request_pending' using errcode = '22023';
      end if;
    end if;
    new.vanish := v_thread.vanish_mode;
  else
    new.vanish := false;
  end if;

  new.body := nullif(btrim(new.body), '');
  v_prefix := new.thread_id::text || '/' || new.id::text;

  -- Content per kind; unrelated columns must stay empty.
  if new.kind not in ('media', 'voice') and (
       new.media_type is not null or new.media_path is not null or new.thumb_path is not null
       or new.waveform is not null or new.view_mode <> 'keep') then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  if (new.post_id is not null and new.kind <> 'post')
     or (new.profile_id is not null and new.kind <> 'profile')
     or (new.audio_id is not null and new.kind <> 'audio')
     or (new.story_id is not null and new.kind not in ('story', 'text'))
     or (new.note_id is not null and new.kind <> 'text') then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  if new.kind = 'text' then
    if new.body is null then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
    if new.story_id is not null then
      -- Story reply: the story must be visible and its author in this chat.
      select author_id into v_story_author from public.stories where id = new.story_id;
      if v_story_author is null or not public.can_view_story(new.story_id)
         or not exists (select 1 from public.thread_members m
                        where m.thread_id = new.thread_id and m.user_id = v_story_author) then
        raise exception 'invalid_message' using errcode = '22023';
      end if;
      new.data := new.data || jsonb_build_object('story_reply', true);
    end if;
    if new.note_id is not null then
      select * into v_note from public.notes where id = new.note_id;
      if v_note.id is null or not public.can_view_note(new.note_id)
         or not exists (select 1 from public.thread_members m
                        where m.thread_id = new.thread_id and m.user_id = v_note.author_id) then
        raise exception 'invalid_message' using errcode = '22023';
      end if;
      new.data := new.data || jsonb_build_object('note', jsonb_build_object(
        'body', v_note.body,
        'author_id', v_note.author_id,
        'audio', (select t.title from public.audio_tracks t where t.id = v_note.audio_track_id)
      ));
    end if;
  elsif new.kind = 'media' then
    if new.media_type not in ('image', 'video')
       or new.media_path !~ ('^' || v_prefix || '\.(jpg|jpeg|png|webp|heic|mp4|mov)$')
       or (new.thumb_path is not null and new.thumb_path <> v_prefix || '-thumb.jpg')
       or coalesce(new.width, 0) <= 0 or coalesce(new.height, 0) <= 0
       or (new.media_type = 'video' and coalesce(new.duration_ms, 0) not between 1 and 180500)
       or (new.media_type = 'image' and new.duration_ms is not null)
       or new.waveform is not null then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  elsif new.kind = 'voice' then
    if new.media_type <> 'audio' or new.view_mode <> 'keep' or new.thumb_path is not null
       or new.media_path !~ ('^' || v_prefix || '\.(m4a|aac|mp3|webm|ogg)$')
       or coalesce(new.duration_ms, 0) not between 300 and 300500 then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  elsif new.kind = 'post' then
    if new.post_id is null or not public.can_view_post(new.post_id)
       or not exists (select 1 from public.posts p
                      where p.id = new.post_id and p.status = 'published') then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  elsif new.kind = 'story' then
    if new.story_id is null or not public.can_view_story(new.story_id)
       or not public.story_is_active(new.story_id) then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  elsif new.kind = 'profile' then
    if new.profile_id is null
       or not exists (select 1 from public.profiles p where p.id = new.profile_id) then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  elsif new.kind = 'audio' then
    if new.audio_id is null or not exists (
      select 1 from public.audio_tracks t
      where t.id = new.audio_id
        and (t.source <> 'original' or t.owner_id = v_me or public.can_view_post(t.origin_post_id))
    ) then
      raise exception 'invalid_message' using errcode = '22023';
    end if;
  end if;

  -- Uploaded files must exist and be mine.
  if new.media_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'messages' and o.name = new.media_path and o.owner_id = v_me::text
  ) then
    raise exception 'missing_file' using errcode = '22023';
  end if;
  if new.thumb_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'messages' and o.name = new.thumb_path and o.owner_id = v_me::text
  ) then
    raise exception 'missing_file' using errcode = '22023';
  end if;

  if new.reply_to_id is not null and not exists (
    select 1 from public.messages r
    where r.id = new.reply_to_id and r.thread_id = new.thread_id and r.kind <> 'system'
      and r.scheduled_for is null
      and public.can_read_message(r.thread_id, r.sender_id, r.created_at, r.scheduled_for)
  ) then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  -- Scheduled messages (page 76): text only, 1 minute … 29 days ahead, not in vanish mode.
  if new.scheduled_for is not null then
    if new.kind <> 'text' or new.vanish or new.story_id is not null or new.note_id is not null
       or new.scheduled_for < now() + interval '30 seconds'
       or new.scheduled_for > now() + interval '29 days' then
      raise exception 'invalid_schedule' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- A message became visible: bump the thread, mark it read for the sender, notify.
create function public.message_delivered(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages;
begin
  select * into v_msg from public.messages where id = p_message;
  update public.threads
  set last_message_at = v_msg.created_at, last_message_id = v_msg.id
  where id = v_msg.thread_id;
  update public.thread_members
  set last_read_at = greatest(last_read_at, v_msg.created_at), marked_unread = false
  where thread_id = v_msg.thread_id and user_id = v_msg.sender_id;
  perform public.thread_broadcast(v_msg.thread_id, 'message',
    jsonb_build_object('message_id', v_msg.id, 'sender_id', v_msg.sender_id));
end;
$$;

create function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if new.kind <> 'system' then
    -- Replying accepts a request.
    update public.thread_members
    set status = 'active', accepted_at = now()
    where thread_id = new.thread_id and user_id = new.sender_id and status in ('request', 'hidden');
    -- Offensive / spammy first messages go to Hidden requests.
    select kind into v_kind from public.threads where id = new.thread_id;
    if v_kind = 'direct' and new.kind = 'text' and public.is_flagged_text(new.body) then
      update public.thread_members
      set status = 'hidden'
      where thread_id = new.thread_id and user_id <> new.sender_id and status = 'request';
    end if;
  end if;
  if new.scheduled_for is null then
    perform public.message_delivered(new.id);
  end if;
  return null;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create function public.messages_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.scheduled_for is not null and new.scheduled_for is null then
    perform public.message_delivered(new.id);
  elsif new.scheduled_for is null then
    perform public.thread_broadcast(new.thread_id, 'message_updated',
      jsonb_build_object('message_id', new.id));
  end if;
  return null;
end;
$$;

create trigger messages_after_update after update on public.messages
  for each row execute function public.messages_after_update();

-- Unsend: point the thread at the previous message.
create function public.messages_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.messages;
begin
  if exists (select 1 from public.threads t
             where t.id = old.thread_id and t.last_message_id is null) then
    select * into v_last from public.messages
    where thread_id = old.thread_id and scheduled_for is null
    order by created_at desc limit 1;
    update public.threads
    set last_message_id = v_last.id, last_message_at = v_last.created_at
    where id = old.thread_id;
  end if;
  if old.scheduled_for is null then
    perform public.thread_broadcast(old.thread_id, 'message_deleted',
      jsonb_build_object('message_id', old.id));
  end if;
  return null;
end;
$$;

create trigger messages_after_delete after delete on public.messages
  for each row execute function public.messages_after_delete();

create function public.message_reactions_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message uuid := coalesce(new.message_id, old.message_id);
  v_thread uuid;
begin
  select thread_id into v_thread from public.messages where id = v_message;
  if v_thread is not null then
    perform public.thread_broadcast(v_thread, 'reaction',
      jsonb_build_object('message_id', v_message, 'user_id', coalesce(new.user_id, old.user_id),
                         'emoji', new.emoji));
  end if;
  return null;
end;
$$;

create trigger message_reactions_after_change
  after insert or update or delete on public.message_reactions
  for each row execute function public.message_reactions_after_change();

-- Pinned chats: at most 3 (page 74).
create function public.thread_members_pin_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pinned_at is not null and old.pinned_at is null and (
    select count(*) from public.thread_members m
    where m.user_id = new.user_id and m.pinned_at is not null
  ) >= 3 then
    raise exception 'pin_limit' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger thread_members_pin_limit before update of pinned_at on public.thread_members
  for each row execute function public.thread_members_pin_limit();

-- Notes: trim, catalog songs only, one active note per author.
create function public.notes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := coalesce(auth.uid(), new.author_id);
  new.body := nullif(btrim(regexp_replace(new.body, '\s+', ' ', 'g')), '');
  new.created_at := now();
  new.expires_at := now() + interval '24 hours';
  if new.audio_track_id is not null and not exists (
    select 1 from public.audio_tracks t where t.id = new.audio_track_id and t.source <> 'original'
  ) then
    raise exception 'invalid_audio' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger notes_before_insert before insert on public.notes
  for each row execute function public.notes_before_insert();

create function public.notes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notes where author_id = new.author_id and id <> new.id;
  return null;
end;
$$;

create trigger notes_after_insert after insert on public.notes
  for each row execute function public.notes_after_insert();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------
alter table public.notes enable row level security;
create policy notes_select_visible on public.notes
  for select to authenticated
  using (author_id = (select auth.uid()) or public.can_view_note(id));
create policy notes_insert_own on public.notes
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy notes_delete_own on public.notes
  for delete to authenticated using (author_id = (select auth.uid()));
revoke insert, update on public.notes from anon, authenticated;
grant insert (body, audio_track_id, audio_start_ms, audience) on public.notes to authenticated;

alter table public.note_likes enable row level security;
create policy note_likes_select_party on public.note_likes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.notes n
               where n.id = note_id and n.author_id = (select auth.uid()))
  );
create policy note_likes_insert_own on public.note_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_note(note_id)
    and exists (select 1 from public.notes n
                where n.id = note_id and n.author_id <> (select auth.uid())
                  and n.expires_at > now())
  );
create policy note_likes_delete_own on public.note_likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.note_likes from anon, authenticated;
grant insert (note_id) on public.note_likes to authenticated;

alter table public.threads enable row level security;
create policy threads_select_member on public.threads
  for select to authenticated using (public.my_thread_status(id) is not null);
revoke insert, update, delete on public.threads from anon, authenticated;

alter table public.thread_members enable row level security;
create policy thread_members_select_own on public.thread_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy thread_members_update_own on public.thread_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.thread_members from anon, authenticated;
grant update (read_receipts, muted_until, pinned_at, marked_unread)
  on public.thread_members to authenticated;

alter table public.thread_join_requests enable row level security;
create policy thread_join_requests_select_party on public.thread_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.thread_members m
               where m.thread_id = thread_join_requests.thread_id
                 and m.user_id = (select auth.uid()) and m.role = 'admin' and m.status = 'active')
  );
revoke insert, update, delete on public.thread_join_requests from anon, authenticated;

alter table public.messages enable row level security;
-- The sender check is inline so `insert … returning` works.
create policy messages_select_reader on public.messages
  for select to authenticated
  using (
    sender_id = (select auth.uid()) and scheduled_for is not null
    or public.can_read_message(thread_id, sender_id, created_at, scheduled_for)
  );
create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind <> 'system'
    and coalesce(public.my_thread_status(thread_id), 'left') <> 'left'
  );
create policy messages_delete_own on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()) and kind <> 'system');
revoke insert, update on public.messages from anon, authenticated;
grant insert (id, thread_id, kind, body, reply_to_id, post_id, story_id, profile_id, audio_id,
              note_id, media_type, media_path, thumb_path, width, height, duration_ms, waveform,
              view_mode, scheduled_for)
  on public.messages to authenticated;

alter table public.message_reactions enable row level security;
create policy message_reactions_select_reader on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy message_reactions_insert_own on public.message_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.kind <> 'system' and m.scheduled_for is null
        and public.my_thread_status(m.thread_id) = 'active'
    )
  );
create policy message_reactions_update_own on public.message_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy message_reactions_delete_own on public.message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.message_reactions from anon, authenticated;
grant insert (message_id, emoji), update (emoji) on public.message_reactions to authenticated;

alter table public.message_views enable row level security;
create policy message_views_select_party on public.message_views
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.messages m
               where m.id = message_id and m.sender_id = (select auth.uid()))
  );
revoke insert, update, delete on public.message_views from anon, authenticated;

alter table public.user_presence enable row level security;
create policy user_presence_select_own on public.user_presence
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_presence from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Storage: messages bucket (Phase 0 left it deny-all)
-- ---------------------------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'video/mp4', 'video/quicktime',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg'
]
where id = 'messages';

create policy messages_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messages'
    and (storage.foldername(name))[1]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and coalesce(public.my_thread_status(((storage.foldername(name))[1])::uuid), 'left') <> 'left'
  );
create policy messages_select_owner on storage.objects
  for select to authenticated
  using (bucket_id = 'messages' and owner_id = (select auth.uid())::text);
create policy messages_select_reader on storage.objects
  for select to authenticated
  using (bucket_id = 'messages' and public.can_view_message_object(name));
create policy messages_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'messages' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
-- Realtime: private broadcast topics
-- ---------------------------------------------------------------------------------------------
create policy realtime_direct_receive on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'inbox:' || (select auth.uid())::text
    or public.realtime_thread_member(realtime.topic(), false)
  );
-- Typing indicators: active members only.
create policy realtime_direct_send on realtime.messages
  for insert to authenticated
  with check (public.realtime_thread_member(realtime.topic(), true));

-- ---------------------------------------------------------------------------------------------
-- RPCs: threads
-- ---------------------------------------------------------------------------------------------
create function public.get_or_create_direct(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_other is null or p_other = auth.uid()
     or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'invalid_recipient' using errcode = '22023';
  end if;
  return public.ensure_direct_thread(auth.uid(), p_other);
end;
$$;

-- Add people to a group (internal): new / returning members, request status for people who
-- don't follow the adder, joined_via, a system line.
create function public.thread_add_members(
  p_thread uuid, p_actor uuid, p_ids uuid[], p_via text default 'added'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct x) into v_ids
  from unnest(p_ids) x
  where exists (select 1 from public.profiles p where p.id = x)
    and not exists (select 1 from public.thread_members m
                    where m.thread_id = p_thread and m.user_id = x and m.status <> 'left');
  if coalesce(cardinality(v_ids), 0) = 0 then
    return 0;
  end if;
  if (select count(*) from public.thread_members m
      where m.thread_id = p_thread and m.status <> 'left') + cardinality(v_ids) > 250 then
    raise exception 'too_many_members' using errcode = '22023';
  end if;
  insert into public.thread_members as tm
    (thread_id, user_id, role, status, added_by, joined_via, joined_at, accepted_at, last_read_at)
  select p_thread, x, 'member', s.status, p_actor, p_via, now(),
         case when s.status = 'active' then now() end, now()
  from unnest(v_ids) x
  cross join lateral (
    select case when p_via = 'invite' or x = p_actor or exists (
      select 1 from public.follows f where f.follower_id = x and f.following_id = p_actor
    ) then 'active' else 'request' end as status
  ) s
  on conflict (thread_id, user_id) do update
    set role = 'member', status = excluded.status, added_by = excluded.added_by,
        joined_via = excluded.joined_via, joined_at = now(), accepted_at = excluded.accepted_at,
        left_at = null, cleared_at = null, pinned_at = null, marked_unread = false,
        last_read_at = now();
  delete from public.thread_join_requests where thread_id = p_thread and user_id = any (v_ids);
  if p_via = 'invite' then
    perform public.add_system_message(p_thread, p_actor, 'joined');
  else
    perform public.add_system_message(p_thread, p_actor, 'added',
      jsonb_build_object('user_ids', to_jsonb(v_ids)));
  end if;
  return cardinality(v_ids);
end;
$$;

create function public.create_group_thread(p_members uuid[], p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[];
  v_thread uuid;
  v_title text := nullif(btrim(p_title), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select array_agg(distinct x) into v_ids
  from unnest(p_members) x
  where x <> v_me and exists (select 1 from public.profiles p where p.id = x);
  if coalesce(cardinality(v_ids), 0) < 2 then
    raise exception 'too_few_members' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 249 then
    raise exception 'too_many_members' using errcode = '22023';
  end if;
  insert into public.threads (kind, created_by, title)
  values ('group', v_me, v_title)
  returning id into v_thread;
  insert into public.thread_members (thread_id, user_id, role, status, added_by, joined_via,
                                     accepted_at)
  values (v_thread, v_me, 'admin', 'active', v_me, 'created', now());
  insert into public.thread_members (thread_id, user_id, status, added_by, joined_via, accepted_at)
  select v_thread, x, s.status, v_me, 'created', case when s.status = 'active' then now() end
  from unnest(v_ids) x
  cross join lateral (
    select case when exists (
      select 1 from public.follows f where f.follower_id = x and f.following_id = v_me
    ) then 'active' else 'request' end as status
  ) s;
  perform public.add_system_message(v_thread, v_me, 'created');
  if v_title is not null then
    perform public.add_system_message(v_thread, v_me, 'renamed', jsonb_build_object('title', v_title));
  end if;
  return v_thread;
end;
$$;

-- Caller's membership, required to be active (and optionally an admin of a group).
create function public.require_thread_member(p_thread uuid, p_admin boolean default false)
returns public.thread_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.thread_members;
begin
  select * into v_member from public.thread_members
  where thread_id = p_thread and user_id = auth.uid();
  if v_member.user_id is null or v_member.status <> 'active' then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_admin and v_member.role <> 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return v_member;
end;
$$;

-- → 'added' | 'requested' (admins must approve when "Approve new members" is on).
create function public.add_thread_members(p_thread uuid, p_members uuid[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.thread_members := public.require_thread_member(p_thread);
  v_thread public.threads;
begin
  select * into v_thread from public.threads where id = p_thread;
  if v_thread.kind <> 'group' then
    raise exception 'not_group' using errcode = '22023';
  end if;
  if v_thread.approval_required and v_member.role <> 'admin' then
    insert into public.thread_join_requests (thread_id, user_id, added_by)
    select p_thread, x, auth.uid()
    from unnest(p_members) x
    where exists (select 1 from public.profiles p where p.id = x)
      and not exists (select 1 from public.thread_members m
                      where m.thread_id = p_thread and m.user_id = x and m.status <> 'left')
    on conflict do nothing;
    perform public.thread_broadcast(p_thread, 'join_requests');
    return 'requested';
  end if;
  perform public.thread_add_members(p_thread, auth.uid(), p_members);
  return 'added';
end;
$$;

create function public.answer_join_request(p_thread uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added_by uuid;
begin
  perform public.require_thread_member(p_thread, true);
  delete from public.thread_join_requests
  where thread_id = p_thread and user_id = p_user
  returning added_by into v_added_by;
  if p_approve and found then
    perform public.thread_add_members(p_thread, coalesce(v_added_by, p_user), array[p_user],
      case when v_added_by is null then 'invite' else 'added' end);
  end if;
  perform public.thread_broadcast(p_thread, 'join_requests');
end;
$$;

create function public.thread_join_request_list(p_thread uuid)
returns table (
  user_id uuid, username text, full_name text, avatar_path text,
  added_by_username text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, a.username, r.created_at
  from public.thread_join_requests r
  join public.profiles p on p.id = r.user_id
  left join public.profiles a on a.id = r.added_by
  where r.thread_id = p_thread
    and exists (select 1 from public.thread_members m
                where m.thread_id = p_thread and m.user_id = auth.uid()
                  and m.role = 'admin' and m.status = 'active')
  order by r.created_at;
$$;

-- Promote the longest-standing active member when a group loses its last admin.
create function public.ensure_thread_admin(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.thread_members
                 where thread_id = p_thread and role = 'admin' and status = 'active') then
    update public.thread_members set role = 'admin'
    where (thread_id, user_id) = (
      select thread_id, user_id from public.thread_members
      where thread_id = p_thread and status = 'active'
      order by joined_at, user_id limit 1
    );
  end if;
end;
$$;

create function public.remove_thread_member(p_thread uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread, true);
  if p_user = auth.uid() then
    raise exception 'use_leave' using errcode = '22023';
  end if;
  update public.thread_members
  set status = 'left', left_at = now(), role = 'member', pinned_at = null
  where thread_id = p_thread and user_id = p_user and status <> 'left';
  if not found then
    raise exception 'not_member' using errcode = 'P0002';
  end if;
  perform public.add_system_message(p_thread, auth.uid(), 'removed',
    jsonb_build_object('user_ids', jsonb_build_array(p_user)));
end;
$$;

create function public.leave_thread(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select kind from public.threads where id = p_thread) is distinct from 'group' then
    raise exception 'not_group' using errcode = '22023';
  end if;
  if coalesce(public.my_thread_status(p_thread), 'left') = 'left' then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform public.add_system_message(p_thread, auth.uid(), 'left');
  update public.thread_members
  set status = 'left', left_at = now(), role = 'member', pinned_at = null
  where thread_id = p_thread and user_id = auth.uid();
  perform public.ensure_thread_admin(p_thread);
end;
$$;

create function public.set_thread_admin(p_thread uuid, p_user uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread, true);
  if not p_admin and not exists (
    select 1 from public.thread_members
    where thread_id = p_thread and role = 'admin' and status = 'active' and user_id <> p_user
  ) then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  update public.thread_members
  set role = case when p_admin then 'admin' else 'member' end
  where thread_id = p_thread and user_id = p_user and status = 'active'
    and role <> case when p_admin then 'admin' else 'member' end;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'admin',
      jsonb_build_object('user_ids', jsonb_build_array(p_user), 'admin', p_admin));
  end if;
end;
$$;

create function public.rename_thread(p_thread uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_title), '');
begin
  perform public.require_thread_member(p_thread);
  update public.threads set title = v_title
  where id = p_thread and kind = 'group' and title is distinct from v_title;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'renamed',
      jsonb_build_object('title', v_title));
  end if;
end;
$$;

create function public.set_thread_photo(p_thread uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread);
  if p_path is not null and (
    p_path !~ ('^' || p_thread::text || '/group-[0-9a-f-]{36}\.jpg$')
    or not exists (select 1 from storage.objects o
                   where o.bucket_id = 'messages' and o.name = p_path)
  ) then
    raise exception 'invalid_photo' using errcode = '22023';
  end if;
  update public.threads set photo_path = p_path
  where id = p_thread and kind = 'group' and photo_path is distinct from p_path;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'photo',
      jsonb_build_object('removed', p_path is null));
  end if;
end;
$$;

create function public.set_thread_theme(p_thread uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread);
  update public.threads set theme = p_theme
  where id = p_thread and theme <> p_theme;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'theme',
      jsonb_build_object('theme', p_theme));
  end if;
end;
$$;

create function public.set_thread_approval(p_thread uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread, true);
  update public.threads set approval_required = p_on
  where id = p_thread and kind = 'group' and approval_required <> p_on;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'approval',
      jsonb_build_object('on', p_on));
    if not p_on then
      perform public.thread_add_members(p_thread, auth.uid(),
        array(select user_id from public.thread_join_requests where thread_id = p_thread));
    end if;
  end if;
end;
$$;

create function public.set_nickname(p_thread uuid, p_user uuid, p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nick text := nullif(btrim(p_nickname), '');
begin
  perform public.require_thread_member(p_thread);
  update public.thread_members set nickname = v_nick
  where thread_id = p_thread and user_id = p_user and status <> 'left'
    and nickname is distinct from v_nick;
  if found then
    perform public.add_system_message(p_thread, auth.uid(), 'nickname',
      jsonb_build_object('user_ids', jsonb_build_array(p_user), 'nickname', v_nick));
  end if;
end;
$$;

-- Vanish mode (1:1, both accepted). Turning it off deletes the vanish messages.
create function public.set_vanish_mode(p_thread uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread);
  if (select kind from public.threads where id = p_thread) <> 'direct'
     or exists (select 1 from public.thread_members
                where thread_id = p_thread and status <> 'active') then
    raise exception 'vanish_unavailable' using errcode = '22023';
  end if;
  update public.threads set vanish_mode = p_on where id = p_thread and vanish_mode <> p_on;
  if found then
    if not p_on then
      delete from public.messages where thread_id = p_thread and vanish;
    end if;
    perform public.add_system_message(p_thread, auth.uid(),
      case when p_on then 'vanish_on' else 'vanish_off' end);
  end if;
end;
$$;

-- Leaving a vanish-mode chat: messages everyone else has seen disappear.
create function public.end_vanish_session(p_thread uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(public.my_thread_status(p_thread), 'left') = 'left' then
    return 0;
  end if;
  delete from public.messages m
  where m.thread_id = p_thread and m.vanish
    and not exists (
      select 1 from public.thread_members o
      where o.thread_id = p_thread and o.user_id <> m.sender_id and o.last_read_at < m.created_at
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Screenshot of a vanish-mode chat or of view-once media.
create function public.note_screenshot(p_thread uuid, p_message uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread);
  if p_message is not null then
    update public.message_views set screenshot_at = now()
    where message_id = p_message and user_id = auth.uid();
    perform public.thread_broadcast(p_thread, 'message_updated',
      jsonb_build_object('message_id', p_message));
  elsif (select vanish_mode from public.threads where id = p_thread) then
    perform public.add_system_message(p_thread, auth.uid(), 'screenshot');
  end if;
end;
$$;

-- Invite links (page 78): admins create / reset / turn off; anyone with the token can join.
create function public.create_thread_invite(p_thread uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  perform public.require_thread_member(p_thread, true);
  update public.threads set invite_token = v_token where id = p_thread and kind = 'group';
  if not found then
    raise exception 'not_group' using errcode = '22023';
  end if;
  return v_token;
end;
$$;

create function public.disable_thread_invite(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_thread_member(p_thread, true);
  update public.threads set invite_token = null where id = p_thread;
end;
$$;

create function public.thread_invite_preview(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'thread_id', t.id,
    'title', t.title,
    'photo_path', t.photo_path,
    'approval_required', t.approval_required,
    'member_count', (select count(*) from public.thread_members m
                     where m.thread_id = t.id and m.status <> 'left'),
    'members', (
      select coalesce(jsonb_agg(x.j), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'username', p.username,
                                  'avatar_path', p.avatar_path) as j
        from public.thread_members m join public.profiles p on p.id = m.user_id
        where m.thread_id = t.id and m.status = 'active'
        order by m.joined_at limit 3
      ) x
    ),
    'my_status', (select m.status from public.thread_members m
                  where m.thread_id = t.id and m.user_id = auth.uid()),
    'requested', exists (select 1 from public.thread_join_requests r
                         where r.thread_id = t.id and r.user_id = auth.uid())
  )
  from public.threads t
  where auth.uid() is not null and t.invite_token = p_token and t.kind = 'group';
$$;

-- → { status: 'joined' | 'requested' | 'member', thread_id }
create function public.join_thread_by_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.threads;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_thread from public.threads where invite_token = p_token and kind = 'group';
  if v_thread.id is null then
    raise exception 'invalid_invite' using errcode = 'P0002';
  end if;
  v_status := public.my_thread_status(v_thread.id);
  if v_status in ('active', 'request', 'hidden') then
    update public.thread_members set status = 'active', accepted_at = now()
    where thread_id = v_thread.id and user_id = auth.uid() and status <> 'active';
    return jsonb_build_object('status', 'member', 'thread_id', v_thread.id);
  end if;
  if v_thread.approval_required then
    insert into public.thread_join_requests (thread_id, user_id, added_by)
    values (v_thread.id, auth.uid(), null)
    on conflict do nothing;
    perform public.thread_broadcast(v_thread.id, 'join_requests');
    return jsonb_build_object('status', 'requested', 'thread_id', v_thread.id);
  end if;
  -- At most 250 joins per link per day.
  if (select count(*) from public.thread_members m
      where m.thread_id = v_thread.id and m.joined_via = 'invite'
        and m.joined_at > now() - interval '1 day') >= 250 then
    raise exception 'invite_limit' using errcode = '22023';
  end if;
  perform public.thread_add_members(v_thread.id, auth.uid(), array[auth.uid()], 'invite');
  return jsonb_build_object('status', 'joined', 'thread_id', v_thread.id);
end;
$$;

-- Requests (page 75).
create function public.accept_thread(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.thread_members
  set status = 'active', accepted_at = now()
  where thread_id = p_thread and user_id = auth.uid() and status in ('request', 'hidden');
  if found then
    perform public.thread_broadcast(p_thread, 'accepted',
      jsonb_build_object('user_id', auth.uid()));
  end if;
end;
$$;

-- "Delete chat" / delete a request: hide everything so far, for me only.
create function public.clear_thread(p_thread uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.thread_members
  set cleared_at = now(), pinned_at = null, marked_unread = false, last_read_at = now()
  where thread_id = p_thread and user_id = auth.uid();
$$;

create function public.clear_requests(p_hidden boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.thread_members
  set cleared_at = now(), last_read_at = now()
  where user_id = auth.uid()
    and status = case when p_hidden then 'hidden' else 'request' end;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.mark_thread_read(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.thread_members;
begin
  update public.thread_members
  set last_read_at = now(), marked_unread = false
  where thread_id = p_thread and user_id = auth.uid()
  returning * into v_member;
  if v_member.user_id is not null and v_member.status = 'active' and v_member.read_receipts then
    perform public.thread_broadcast(p_thread, 'read',
      jsonb_build_object('user_id', auth.uid(), 'at', v_member.last_read_at));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs: messages
-- ---------------------------------------------------------------------------------------------
-- Edit (own text, within 15 minutes; scheduled messages any time before they're sent).
create function public.edit_message(p_message uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := nullif(btrim(p_body), '');
begin
  if v_body is null or char_length(v_body) > 1000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  update public.messages
  set body = v_body,
      edited_at = case when scheduled_for is null then now() end
  where id = p_message and sender_id = auth.uid() and kind = 'text' and not vanish
    and (scheduled_for is not null or created_at > now() - interval '15 minutes');
  if not found then
    raise exception 'cannot_edit' using errcode = '22023';
  end if;
end;
$$;

-- Pin / unpin a message for everyone in the chat (≤3).
create function public.pin_message(p_message uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages;
begin
  select * into v_msg from public.messages where id = p_message;
  if v_msg.id is null or v_msg.kind = 'system' or v_msg.scheduled_for is not null or v_msg.vanish
     or not public.can_read_message(v_msg.thread_id, v_msg.sender_id, v_msg.created_at,
                                    v_msg.scheduled_for) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.require_thread_member(v_msg.thread_id);
  if p_pinned and v_msg.pinned_at is null and (
    select count(*) from public.messages
    where thread_id = v_msg.thread_id and pinned_at is not null
  ) >= 3 then
    raise exception 'pin_limit' using errcode = '22023';
  end if;
  update public.messages
  set pinned_at = case when p_pinned then now() end,
      pinned_by = case when p_pinned then auth.uid() end
  where id = p_message and (pinned_at is null) = p_pinned;
  if found and p_pinned then
    perform public.add_system_message(v_msg.thread_id, auth.uid(), 'pinned',
      jsonb_build_object('message_id', p_message));
  end if;
end;
$$;

-- Open view-once (1 view) / replay (2 views) media; the file is readable for 5 minutes after.
-- View-once media expires after 14 days.
create function public.open_message_media(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages;
  v_views public.message_views;
  v_limit integer;
begin
  select * into v_msg from public.messages where id = p_message;
  if v_msg.id is null or v_msg.kind <> 'media'
     or not public.can_read_message(v_msg.thread_id, v_msg.sender_id, v_msg.created_at,
                                    v_msg.scheduled_for) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_msg.sender_id = auth.uid() or v_msg.view_mode = 'keep' then
    return true;
  end if;
  if v_msg.created_at < now() - interval '14 days' then
    return false;
  end if;
  select * into v_views from public.message_views
  where message_id = p_message and user_id = auth.uid();
  v_limit := case v_msg.view_mode when 'replay' then 2 else 1 end;
  if v_views.view_count >= v_limit then
    return false;
  end if;
  insert into public.message_views (message_id, user_id, view_count)
  values (p_message, auth.uid(), 1)
  on conflict (message_id, user_id) do update
    set view_count = public.message_views.view_count + 1, last_viewed_at = now();
  perform public.thread_broadcast(v_msg.thread_id, 'message_updated',
    jsonb_build_object('message_id', p_message));
  return true;
end;
$$;

-- Files I uploaded that can go: orphans (unsent / vanished / never sent, >1 h old) and view-once
-- media every recipient has used up or that expired. The app deletes them on launch.
create function public.my_purgeable_message_files()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  left join public.messages m
    on m.id = case
      when storage.filename(o.name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
      then substring(storage.filename(o.name) from 1 for 36)::uuid
    end
  where o.bucket_id = 'messages' and o.owner_id = auth.uid()::text
    and storage.filename(o.name) not like 'group-%'
    and (
      (m.id is null and o.created_at < now() - interval '1 hour')
      or (
        m.view_mode in ('once', 'replay')
        and (
          m.created_at < now() - interval '14 days'
          or not exists (
            select 1 from public.thread_members tm
            where tm.thread_id = m.thread_id and tm.user_id <> m.sender_id
              and tm.status <> 'left' and tm.joined_at <= m.created_at
              and coalesce((select v.view_count from public.message_views v
                            where v.message_id = m.id and v.user_id = tm.user_id), 0)
                  < case m.view_mode when 'replay' then 2 else 1 end
          )
        )
      )
    )
  union all
  -- Replaced group photos.
  select o.name
  from storage.objects o
  where o.bucket_id = 'messages' and o.owner_id = auth.uid()::text
    and storage.filename(o.name) like 'group-%'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from public.threads t where t.photo_path = o.name)
  limit 200;
$$;

-- pg_cron: deliver scheduled messages (every minute).
create function public.deliver_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.messages
  set created_at = now(), scheduled_for = null
  where scheduled_for is not null and scheduled_for <= now()
    and coalesce((select m.status from public.thread_members m
                  where m.thread_id = messages.thread_id and m.user_id = messages.sender_id),
                 'left') <> 'left';
  get diagnostics v_count = row_count;
  -- Senders who left the chat lose their scheduled messages.
  delete from public.messages
  where scheduled_for is not null and scheduled_for <= now();
  delete from public.notes where expires_at < now() - interval '1 day';
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs: presence
-- ---------------------------------------------------------------------------------------------
create function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_presence (user_id, last_active_at)
  select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_active_at = now();
$$;

-- Last active time of people who follow each other with me, or share an accepted chat.
create function public.presence_of(p_users uuid[])
returns table (user_id uuid, last_active_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.user_id, u.last_active_at
  from public.user_presence u
  where u.user_id = any (p_users) and u.user_id <> auth.uid()
    and exists (select 1 from public.user_presence me where me.user_id = auth.uid())
    and (
      exists (select 1 from public.follows f
              where (f.follower_id = auth.uid() and f.following_id = u.user_id)
                 or (f.follower_id = u.user_id and f.following_id = auth.uid()))
      or exists (
        select 1 from public.thread_members a
        join public.thread_members b on b.thread_id = a.thread_id
        where a.user_id = auth.uid() and a.status = 'active'
          and b.user_id = u.user_id and b.status = 'active'
      )
    );
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs: reads
-- ---------------------------------------------------------------------------------------------
-- Inbox (page 74) / Requests / Hidden requests (page 75).
create function public.inbox_threads(
  p_folder text default 'inbox',
  p_before timestamptz default null,
  p_limit integer default 30,
  p_query text default null
)
returns table (
  id uuid,
  kind text,
  title text,
  photo_path text,
  theme text,
  vanish_mode boolean,
  my_status text,
  my_role text,
  muted boolean,
  pinned_at timestamptz,
  unread boolean,
  unread_count integer,
  last_message_at timestamptz,
  last_message jsonb,
  members jsonb,
  member_count integer,
  seen boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select m.* from public.thread_members m
    where m.user_id = auth.uid()
      and case p_folder
        when 'requests' then m.status = 'request'
        when 'hidden' then m.status = 'hidden'
        else m.status in ('active', 'left')
      end
  ),
  candidates as (
    select t.*, me.status as my_status, me.role as my_role, me.muted_until, me.pinned_at as my_pin,
           me.last_read_at, me.marked_unread, me.read_receipts as my_receipts, me.cleared_at,
           me.joined_at as my_joined, me.left_at as my_left
    from me
    join public.threads t on t.id = me.thread_id
    where t.last_message_at is not null
      and t.last_message_at >= me.joined_at
      and (me.cleared_at is null or t.last_message_at > me.cleared_at)
      and (
        nullif(btrim(p_query), '') is null
        or t.title ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1 from public.thread_members o join public.profiles p on p.id = o.user_id
          where o.thread_id = t.id and o.user_id <> auth.uid() and o.status <> 'left'
            and (p.username ilike btrim(p_query) || '%' or p.full_name ilike '%' || btrim(p_query) || '%'
                 or o.nickname ilike '%' || btrim(p_query) || '%')
        )
      )
      and (
        case
          when p_before is null then true
          else me.pinned_at is null and t.last_message_at < p_before
        end
      )
  ),
  page as (
    select * from candidates
    order by (p_folder = 'inbox' and p_before is null and my_pin is not null) desc,
             my_pin desc nulls last, last_message_at desc
    limit least(greatest(p_limit, 1), 50) + (case when p_before is null then 3 else 0 end)
  )
  select
    r.id, r.kind, r.title, r.photo_path, r.theme, r.vanish_mode, r.my_status, r.my_role,
    coalesce(r.muted_until > now(), false),
    case when p_folder = 'inbox' then r.my_pin end,
    r.marked_unread or u.cnt > 0,
    u.cnt,
    r.last_message_at,
    (
      select jsonb_build_object(
        'id', lm.id, 'sender_id', lm.sender_id, 'kind', lm.kind,
        'body', case when lm.vanish then null else lm.body end,
        'media_type', lm.media_type, 'view_mode', lm.view_mode, 'vanish', lm.vanish,
        'data', lm.data, 'story_reply', lm.story_id is not null and lm.kind = 'text',
        'post_kind', (select p.kind from public.posts p where p.id = lm.post_id),
        'created_at', lm.created_at
      )
      from public.messages lm
      where lm.id = r.last_message_id
        and (r.my_left is null or lm.created_at <= r.my_left)
    ),
    (
      select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb) from (
        select jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name,
                                  'avatar_path', p.avatar_path, 'nickname', o.nickname) as j,
               o.joined_at as ord
        from public.thread_members o join public.profiles p on p.id = o.user_id
        where o.thread_id = r.id and o.user_id <> auth.uid()
          and (o.status <> 'left' or r.kind = 'direct')
        order by o.joined_at limit 3
      ) x
    ),
    (select count(*)::integer from public.thread_members o
     where o.thread_id = r.id and o.status <> 'left'),
    (
      r.my_status = 'active' and r.my_receipts and exists (
        select 1 from public.messages lm
        join public.thread_members o
          on o.thread_id = lm.thread_id and o.user_id <> lm.sender_id
        where lm.id = r.last_message_id and lm.sender_id = auth.uid()
          and o.status = 'active' and o.read_receipts and o.last_read_at >= lm.created_at
      )
    )
  from page r
  cross join lateral (
    select count(*)::integer as cnt from (
      select 1 from public.messages m
      where m.thread_id = r.id and m.sender_id <> auth.uid() and m.scheduled_for is null
        and m.created_at > r.last_read_at and m.created_at >= r.my_joined
        and (r.cleared_at is null or m.created_at > r.cleared_at)
        and (r.my_left is null or m.created_at <= r.my_left)
      limit 5
    ) c
  ) u
  order by (p_folder = 'inbox' and p_before is null and r.my_pin is not null) desc,
           r.my_pin desc nulls last, r.last_message_at desc;
$$;

-- Home ✈ badge: unread, unmuted chats; plus pending request count.
create function public.direct_badge()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'unread', (
      select count(*) from public.thread_members me
      join public.threads t on t.id = me.thread_id
      where me.user_id = auth.uid() and me.status = 'active'
        and (me.muted_until is null or me.muted_until < now())
        and t.last_message_at is not null
        and (me.marked_unread or exists (
          select 1 from public.messages m
          where m.thread_id = t.id and m.sender_id <> auth.uid() and m.scheduled_for is null
            and m.created_at > me.last_read_at and m.created_at >= me.joined_at
            and (me.cleared_at is null or m.created_at > me.cleared_at)
        ))
    ),
    'requests', (
      select count(*) from public.thread_members me
      join public.threads t on t.id = me.thread_id
      where me.user_id = auth.uid() and me.status = 'request'
        and t.last_message_at is not null
        and (me.cleared_at is null or t.last_message_at > me.cleared_at)
    ),
    'hidden', (
      select count(*) from public.thread_members me
      join public.threads t on t.id = me.thread_id
      where me.user_id = auth.uid() and me.status = 'hidden'
        and t.last_message_at is not null
        and (me.cleared_at is null or t.last_message_at > me.cleared_at)
    )
  );
$$;

-- Thread header + details (pages 76 / 79): thread, my state, members (with seen time when both
-- sides allow read receipts), request state, pinned / join request counts.
create function public.thread_info(p_thread uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'kind', t.kind,
    'title', t.title,
    'photo_path', t.photo_path,
    'theme', t.theme,
    'approval_required', t.approval_required,
    'vanish_mode', t.vanish_mode,
    'invite_token', case when me.status = 'active' then t.invite_token end,
    'created_at', t.created_at,
    'has_messages', t.last_message_at is not null,
    'me', jsonb_build_object(
      'status', me.status, 'role', me.role, 'read_receipts', me.read_receipts,
      'muted_until', me.muted_until, 'pinned_at', me.pinned_at, 'nickname', me.nickname,
      'joined_at', me.joined_at, 'left_at', me.left_at, 'marked_unread', me.marked_unread
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'username', p.username, 'full_name', p.full_name,
        'avatar_path', p.avatar_path, 'is_private', p.is_private,
        'followers_count', p.followers_count, 'posts_count', p.posts_count,
        'role', o.role, 'status', o.status, 'nickname', o.nickname, 'joined_at', o.joined_at,
        'last_read_at', case
          when o.user_id <> auth.uid() and o.status = 'active' and o.read_receipts
               and me.status = 'active' and me.read_receipts then o.last_read_at
        end,
        'last_active_at', (select pr.last_active_at from public.presence_of(array[o.user_id]) pr),
        'i_follow', exists (select 1 from public.follows f
                            where f.follower_id = auth.uid() and f.following_id = p.id),
        'follows_me', exists (select 1 from public.follows f
                              where f.follower_id = p.id and f.following_id = auth.uid())
      ) order by (o.user_id = auth.uid()), o.role, o.joined_at), '[]'::jsonb)
      from public.thread_members o join public.profiles p on p.id = o.user_id
      where o.thread_id = t.id and (o.status <> 'left' or t.kind = 'direct')
    ),
    'request_pending', t.kind = 'direct' and exists (
      select 1 from public.thread_members o
      where o.thread_id = t.id and o.user_id <> auth.uid() and o.status in ('request', 'hidden')
    ),
    'my_message_count', (select count(*) from public.messages m
                         where m.thread_id = t.id and m.sender_id = auth.uid()
                           and m.kind <> 'system'),
    'pinned_count', (select count(*) from public.messages m
                     where m.thread_id = t.id and m.pinned_at is not null
                       and public.can_read_message(m.thread_id, m.sender_id, m.created_at,
                                                   m.scheduled_for)),
    'scheduled_count', (select count(*) from public.messages m
                        where m.thread_id = t.id and m.sender_id = auth.uid()
                          and m.scheduled_for is not null),
    'join_request_count', case when me.role = 'admin' then
      (select count(*) from public.thread_join_requests r where r.thread_id = t.id) end
  )
  from public.threads t
  join public.thread_members me on me.thread_id = t.id and me.user_id = auth.uid()
  where t.id = p_thread;
$$;

-- Messages of a thread, newest first (page 76), or a filtered list for chat details (page 79):
-- pinned, media (kept photos / videos), links, posts (shared posts / reels), scheduled (mine),
-- or a text search. Reply previews, shared story / profile / audio snippets, reactions and
-- view-once views are embedded.
create function public.thread_messages(
  p_thread uuid,
  p_before timestamptz default null,
  p_limit integer default 40,
  p_filter text default null,
  p_query text default null
)
returns table (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  kind text,
  body text,
  reply_to jsonb,
  post_id uuid,
  story jsonb,
  profile jsonb,
  audio jsonb,
  media_type text,
  media_path text,
  thumb_path text,
  width integer,
  height integer,
  duration_ms integer,
  waveform jsonb,
  view_mode text,
  data jsonb,
  vanish boolean,
  pinned_at timestamptz,
  edited_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz,
  reactions jsonb,
  views jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id, m.thread_id, m.sender_id, m.kind, m.body,
    (
      select jsonb_build_object(
        'id', r.id, 'sender_id', r.sender_id, 'kind', r.kind, 'body', r.body,
        'media_type', r.media_type, 'view_mode', r.view_mode,
        'media_path', case when r.view_mode = 'keep' and r.kind = 'media' then r.media_path end,
        'thumb_path', case when r.view_mode = 'keep' then r.thumb_path end,
        'post_id', r.post_id
      )
      from public.messages r where r.id = m.reply_to_id
    ),
    m.post_id,
    case when m.story_id is not null then coalesce(
      (select jsonb_build_object(
          'id', s.id, 'author_id', s.author_id, 'kind', s.kind, 'visible', true,
          'thumb_path', coalesce(s.thumb_path, s.media_path),
          'active', s.published_at > now() - interval '24 hours')
       from public.stories s where s.id = m.story_id),
      jsonb_build_object('id', m.story_id, 'visible', false))
    end,
    case when m.profile_id is not null then (
      select jsonb_build_object(
        'id', p.id, 'username', p.username, 'full_name', p.full_name,
        'avatar_path', p.avatar_path, 'is_private', p.is_private,
        'followers_count', p.followers_count, 'posts_count', p.posts_count)
      from public.profiles p where p.id = m.profile_id)
    end,
    case when m.audio_id is not null then coalesce(
      (select jsonb_build_object(
          'id', a.id, 'title', a.title, 'artist', a.artist, 'source', a.source,
          'cover_color', a.cover_color, 'audio_path', a.audio_path,
          'owner_username', (select p.username from public.profiles p where p.id = a.owner_id))
       from public.audio_tracks a where a.id = m.audio_id),
      jsonb_build_object('id', m.audio_id, 'unavailable', true))
    end,
    m.media_type, m.media_path, m.thumb_path, m.width, m.height, m.duration_ms, m.waveform,
    m.view_mode, m.data, m.vanish, m.pinned_at, m.edited_at, m.scheduled_for, m.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'emoji', x.emoji)
                               order by x.created_at), '[]'::jsonb)
     from public.message_reactions x where x.message_id = m.id),
    case when m.view_mode <> 'keep' then
      (select coalesce(jsonb_agg(jsonb_build_object(
                'user_id', v.user_id, 'view_count', v.view_count,
                'screenshot_at', v.screenshot_at)), '[]'::jsonb)
       from public.message_views v where v.message_id = m.id)
    end
  from public.messages m
  where m.thread_id = p_thread
    and (p_before is null or m.created_at < p_before)
    and case coalesce(p_filter, '')
      when 'scheduled' then m.scheduled_for is not null and m.sender_id = auth.uid()
      when 'pinned' then m.pinned_at is not null and m.scheduled_for is null
      when 'media' then m.kind = 'media' and m.view_mode = 'keep' and m.scheduled_for is null
      when 'links' then m.kind = 'text' and m.body ~* 'https?://|www\.' and m.scheduled_for is null
      when 'posts' then m.kind = 'post' and m.scheduled_for is null
      else m.scheduled_for is null
    end
    and (nullif(btrim(p_query), '') is null
         or (m.kind = 'text' and not m.vanish and m.body ilike '%' || btrim(p_query) || '%'))
  order by
    case when p_filter = 'scheduled' then m.scheduled_for end,
    case when p_filter = 'pinned' then m.pinned_at end desc,
    m.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- "Send to" targets (share sheets, New message): recent chats, then people.
create function public.share_suggestions(p_query text default null, p_limit integer default 30)
returns table (
  thread_id uuid,
  kind text,
  title text,
  photo_path text,
  members jsonb,
  user_id uuid,
  username text,
  full_name text,
  avatar_path text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (select nullif(lower(btrim(p_query)), '') as q),
  chats as (
    select t.id, t.kind, t.title, t.photo_path, t.last_message_at,
      (select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username,
                                           'full_name', p.full_name, 'avatar_path', p.avatar_path,
                                           'nickname', o.nickname) order by o.joined_at)
       from public.thread_members o join public.profiles p on p.id = o.user_id
       where o.thread_id = t.id and o.user_id <> auth.uid() and o.status <> 'left') as members,
      (select o.user_id from public.thread_members o
       where t.kind = 'direct' and o.thread_id = t.id and o.user_id <> auth.uid()) as other
    from public.thread_members me
    join public.threads t on t.id = me.thread_id
    where me.user_id = auth.uid() and me.status = 'active' and t.last_message_at is not null
  ),
  chat_rows as (
    select c.* from chats c, params q
    where (c.kind = 'group' or c.other is not null)
      and (q.q is null
           or c.title ilike '%' || q.q || '%'
           or exists (select 1 from jsonb_array_elements(c.members) e
                      where e->>'username' like q.q || '%'
                         or e->>'full_name' ilike '%' || q.q || '%'))
    order by c.last_message_at desc
    limit least(greatest(p_limit, 1), 50)
  ),
  people as (
    select p.id, p.username, p.full_name, p.avatar_path
    from public.profiles p, params q
    where p.id <> auth.uid()
      and not exists (select 1 from chat_rows c where c.other = p.id)
      and (
        (q.q is null and exists (select 1 from public.follows f
                                 where f.follower_id = auth.uid() and f.following_id = p.id))
        or (q.q is not null and (p.username like q.q || '%' or p.full_name ilike '%' || q.q || '%'))
      )
    order by
      exists (select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.id) desc,
      (p.username = (select params.q from params)) desc,
      p.followers_count desc, p.username
    limit least(greatest(p_limit, 1), 50)
  )
  select c.id, c.kind, c.title, c.photo_path, coalesce(c.members, '[]'::jsonb),
         c.other, op.username, op.full_name, op.avatar_path, c.last_message_at
  from chat_rows c left join public.profiles op on op.id = c.other
  union all
  select null, 'direct', null, null, '[]'::jsonb, p.id, p.username, p.full_name, p.avatar_path, null
  from people p;
$$;

-- Notes row (page 81): mine first, then visible notes, newest first.
create function public.notes_tray()
returns table (
  id uuid,
  author_id uuid,
  username text,
  full_name text,
  avatar_path text,
  body text,
  audio jsonb,
  audience text,
  created_at timestamptz,
  expires_at timestamptz,
  liked boolean,
  like_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.author_id, p.username, p.full_name, p.avatar_path, n.body,
    case when n.audio_track_id is not null then (
      select jsonb_build_object('id', a.id, 'title', a.title, 'artist', a.artist,
                                'audio_path', a.audio_path, 'cover_color', a.cover_color,
                                'start_ms', n.audio_start_ms)
      from public.audio_tracks a where a.id = n.audio_track_id)
    end,
    n.audience, n.created_at, n.expires_at,
    exists (select 1 from public.note_likes l where l.note_id = n.id and l.user_id = auth.uid()),
    case when n.author_id = auth.uid() then
      (select count(*)::integer from public.note_likes l where l.note_id = n.id)
    end
  from public.notes n
  join public.profiles p on p.id = n.author_id
  where n.expires_at > now()
  order by (n.author_id = auth.uid()) desc, n.created_at desc
  limit 60;
$$;

create function public.note_likers(p_note uuid)
returns table (user_id uuid, username text, full_name text, avatar_path text, liked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.full_name, p.avatar_path, l.created_at
  from public.note_likes l join public.profiles p on p.id = l.user_id
  where l.note_id = p_note
  order by l.created_at desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- Story replies → DMs (Phase 5 stored them in story_replies; decision 2026-10-09)
-- ---------------------------------------------------------------------------------------------
create function public.story_replies_to_dm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_thread uuid;
begin
  select author_id into v_author from public.stories where id = new.story_id;
  if v_author is null or v_author = new.sender_id then
    return null;
  end if;
  v_thread := public.ensure_direct_thread(new.sender_id, v_author);
  insert into public.messages (thread_id, sender_id, kind, body, story_id, data)
  values (v_thread, new.sender_id, 'text', new.body, new.story_id,
          jsonb_build_object('story_reply', true, 'reaction', new.is_reaction));
  return null;
end;
$$;

create trigger story_replies_to_dm after insert on public.story_replies
  for each row execute function public.story_replies_to_dm();

-- Backfill replies stored before Phase 9 (no auth.uid() here → validation is skipped).
do $$
declare
  r record;
  v_thread uuid;
begin
  for r in
    select sr.*, s.author_id from public.story_replies sr
    join public.stories s on s.id = sr.story_id
    where s.author_id <> sr.sender_id
    order by sr.created_at
  loop
    v_thread := public.ensure_direct_thread(r.sender_id, r.author_id);
    insert into public.messages (thread_id, sender_id, kind, body, story_id, data, created_at)
    values (v_thread, r.sender_id, 'text', r.body, r.story_id,
            jsonb_build_object('story_reply', true, 'reaction', r.is_reaction), r.created_at);
  end loop;
  -- ensure_direct_thread sets joined_at = now(); backfilled history predates it.
  update public.thread_members tm
  set joined_at = least(tm.joined_at, t.created_at, coalesce(
        (select min(m.created_at) from public.messages m where m.thread_id = t.id), tm.joined_at)),
      last_read_at = case when tm.user_id = t.created_by then now() else tm.last_read_at end
  from public.threads t
  where t.id = tm.thread_id;
  update public.threads t
  set created_at = least(t.created_at, coalesce(
        (select min(m.created_at) from public.messages m where m.thread_id = t.id), t.created_at));
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Reports on messages / group chats (page 79 → page 50 flow)
-- ---------------------------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_valid;
alter table public.reports add constraint reports_target_type_valid
  check (target_type in ('post', 'comment', 'profile', 'story', 'audio', 'hashtag', 'message',
                         'thread'));

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
  elsif new.target_type = 'message' then
    select m.sender_id into v_owner from public.messages m
    where m.id = new.target_id and m.kind <> 'system'
      and public.can_read_message(m.thread_id, m.sender_id, m.created_at, m.scheduled_for);
    if v_owner is null then
      raise exception 'target_not_found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'thread' then
    -- Group chats have no single owner.
    if public.my_thread_status(new.target_id) is null then
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
-- pg_cron: scheduled messages + expired notes
-- ---------------------------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('deliver-scheduled-messages', '* * * * *',
                     'select public.deliver_scheduled_messages()');

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
-- Internal (triggers / definer helpers only).
revoke execute on function public.thread_broadcast(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_system_message(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ensure_direct_thread(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;
revoke execute on function public.message_delivered(uuid) from public, anon, authenticated;
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
revoke execute on function public.messages_after_update() from public, anon, authenticated;
revoke execute on function public.messages_after_delete() from public, anon, authenticated;
revoke execute on function public.message_reactions_after_change() from public, anon, authenticated;
revoke execute on function public.thread_members_pin_limit() from public, anon, authenticated;
revoke execute on function public.notes_before_insert() from public, anon, authenticated;
revoke execute on function public.notes_after_insert() from public, anon, authenticated;
revoke execute on function public.thread_add_members(uuid, uuid, uuid[], text) from public, anon, authenticated;
revoke execute on function public.ensure_thread_admin(uuid) from public, anon, authenticated;
revoke execute on function public.deliver_scheduled_messages() from public, anon, authenticated;
revoke execute on function public.story_replies_to_dm() from public, anon, authenticated;

-- Helpers used by policies.
revoke execute on function public.direct_key(uuid, uuid) from public, anon;
revoke execute on function public.my_thread_status(uuid) from public, anon;
revoke execute on function public.can_read_message(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.is_flagged_text(text) from public, anon;
revoke execute on function public.can_view_note(uuid) from public, anon;
revoke execute on function public.can_view_message_object(text) from public, anon;
revoke execute on function public.realtime_thread_member(text, boolean) from public, anon;
revoke execute on function public.require_thread_member(uuid, boolean) from public, anon;
grant execute on function public.direct_key(uuid, uuid) to authenticated;
grant execute on function public.my_thread_status(uuid) to authenticated;
grant execute on function public.can_read_message(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.is_flagged_text(text) to authenticated;
grant execute on function public.can_view_note(uuid) to authenticated;
grant execute on function public.can_view_message_object(text) to authenticated;
grant execute on function public.realtime_thread_member(text, boolean) to authenticated;
grant execute on function public.require_thread_member(uuid, boolean) to authenticated;

-- RPCs.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.get_or_create_direct(uuid)',
    'public.create_group_thread(uuid[], text)',
    'public.add_thread_members(uuid, uuid[])',
    'public.answer_join_request(uuid, uuid, boolean)',
    'public.thread_join_request_list(uuid)',
    'public.remove_thread_member(uuid, uuid)',
    'public.leave_thread(uuid)',
    'public.set_thread_admin(uuid, uuid, boolean)',
    'public.rename_thread(uuid, text)',
    'public.set_thread_photo(uuid, text)',
    'public.set_thread_theme(uuid, text)',
    'public.set_thread_approval(uuid, boolean)',
    'public.set_nickname(uuid, uuid, text)',
    'public.set_vanish_mode(uuid, boolean)',
    'public.end_vanish_session(uuid)',
    'public.note_screenshot(uuid, uuid)',
    'public.create_thread_invite(uuid)',
    'public.disable_thread_invite(uuid)',
    'public.thread_invite_preview(text)',
    'public.join_thread_by_invite(text)',
    'public.accept_thread(uuid)',
    'public.clear_thread(uuid)',
    'public.clear_requests(boolean)',
    'public.mark_thread_read(uuid)',
    'public.edit_message(uuid, text)',
    'public.pin_message(uuid, boolean)',
    'public.open_message_media(uuid)',
    'public.my_purgeable_message_files()',
    'public.touch_presence()',
    'public.presence_of(uuid[])',
    'public.inbox_threads(text, timestamptz, integer, text)',
    'public.direct_badge()',
    'public.thread_info(uuid)',
    'public.thread_messages(uuid, timestamptz, integer, text, text)',
    'public.share_suggestions(text, integer)',
    'public.notes_tray()',
    'public.note_likers(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;
