-- Phase 4 — Home Feed & Post Interactions (pages 43–51)
--
-- * posts: trigger-kept like_count, comment_count, repost_count
-- * likes, comments (one level of replies, pin ≤3, hide), comment_likes
-- * saves (+ saved_collection_items stay in sync), reposts (public posts only)
-- * post_hides (Hide / Not interested / reported), post_seen (ranking), reports
-- * RPCs: post_cards, home_feed, suggested_posts, following_feed, post_comments, post_likers,
--   comment_likers, set_comment_pinned, set_comment_hidden, mark_posts_seen, saved_posts;
--   profile_posts gains kind 'reposts'.

-- ---------------------------------------------------------------------------------------------
-- Counters on posts (never written by clients: no column grant)
-- ---------------------------------------------------------------------------------------------
alter table public.posts
  add column like_count integer not null default 0,
  add column comment_count integer not null default 0,
  add column repost_count integer not null default 0;

-- Feed scans: recent published posts.
create index posts_published_idx on public.posts (published_at desc) where status = 'published';

-- ---------------------------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------------------------
create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index likes_user_idx on public.likes (user_id, created_at desc);

alter table public.likes enable row level security;

-- Likers are visible to whoever can see the post (also when the author hides the count).
create policy likes_select_visible on public.likes
  for select to authenticated using (public.can_view_post(post_id));
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_post(post_id));
create policy likes_delete_own on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.likes from anon, authenticated;

create function public.likes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_after_change
  after insert or delete on public.likes
  for each row execute function public.likes_after_change();

-- ---------------------------------------------------------------------------------------------
-- comments (page 46)
-- ---------------------------------------------------------------------------------------------

-- Comment rules: 1–2,200 characters, ≤30 hashtags, ≤5 @mentions (Instagram's comment limit).
create function public.is_valid_comment(body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(trim(body)) between 1 and 2200
    and (select count(*) from regexp_matches(body, '#[[:alnum:]_]+', 'g')) <= 30
    and (select count(*) from regexp_matches(body, '@[A-Za-z0-9._]+', 'g')) <= 5;
$$;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- One level of replies: a reply's parent is always a top-level comment (trigger re-points).
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  pinned_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  constraint comments_body_valid check (public.is_valid_comment(body)),
  constraint comments_pin_top_level check (pinned_at is null or parent_id is null)
);

create index comments_post_idx on public.comments (post_id, created_at desc) where parent_id is null;
create index comments_parent_idx on public.comments (parent_id, created_at);
create index comments_author_idx on public.comments (author_id);

alter table public.comments enable row level security;

-- Hidden comments stay visible to their writer (Instagram doesn't tell them) and the post author.
create policy comments_select_visible on public.comments
  for select to authenticated
  using (
    public.can_view_post(post_id)
    and (
      hidden_at is null
      or author_id = (select auth.uid())
      or exists (
        select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
      )
    )
  );
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_view_post(post_id)
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published' and not p.comments_disabled
    )
  );
-- Writer deletes own comment; the post author deletes any comment on their post.
create policy comments_delete_party on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

-- Clients insert (id, post_id, parent_id, body); pin/hide go through RPCs; no edits (like IG).
revoke insert, update on public.comments from anon, authenticated;
grant insert (id, post_id, parent_id, body) on public.comments to authenticated;

create function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments;
begin
  new.body := trim(new.body);
  new.created_at := now();
  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id then
      raise exception 'parent_not_found' using errcode = '22023';
    end if;
    -- Replying to a reply joins the parent's thread.
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

create function public.comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    if new.parent_id is not null then
      update public.comments set reply_count = reply_count + 1 where id = new.parent_id;
    end if;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    if old.parent_id is not null then
      update public.comments set reply_count = greatest(reply_count - 1, 0)
      where id = old.parent_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger comments_after_change
  after insert or delete on public.comments
  for each row execute function public.comments_after_change();

-- ---------------------------------------------------------------------------------------------
-- comment_likes
-- ---------------------------------------------------------------------------------------------
create table public.comment_likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_user_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

-- Visible / likeable when the comment itself is visible (comments RLS applies in the subquery).
create policy comment_likes_select_visible on public.comment_likes
  for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
create policy comment_likes_insert_own on public.comment_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id)
  );
create policy comment_likes_delete_own on public.comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.comment_likes from anon, authenticated;

create function public.comment_likes_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_after_change
  after insert or delete on public.comment_likes
  for each row execute function public.comment_likes_after_change();

-- ---------------------------------------------------------------------------------------------
-- saves (bookmark). "All posts" = saves; collections are subsets of saves.
-- ---------------------------------------------------------------------------------------------
create table public.saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index saves_post_idx on public.saves (post_id);
create index saves_user_created_idx on public.saves (user_id, created_at desc);

alter table public.saves enable row level security;

create policy saves_select_own on public.saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy saves_insert_own on public.saves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_post(post_id));
create policy saves_delete_own on public.saves
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.saves from anon, authenticated;

-- Unsaving removes the post from every collection of that user.
create function public.saves_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_collection_items i
  using public.saved_collections c
  where i.collection_id = c.id and c.owner_id = old.user_id and i.post_id = old.post_id;
  return null;
end;
$$;

create trigger saves_after_delete
  after delete on public.saves
  for each row execute function public.saves_after_delete();

-- Adding to a collection saves the post (must be visible to the collection owner).
create function public.saved_collection_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.saved_collections where id = new.collection_id;
  if not public.can_view_post(new.post_id) then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;
  insert into public.saves (user_id, post_id) values (v_owner, new.post_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger saved_collection_items_before_insert
  before insert on public.saved_collection_items
  for each row execute function public.saved_collection_items_before_insert();

-- ---------------------------------------------------------------------------------------------
-- reposts (page 48): public posts only, not your own, optional short note
-- ---------------------------------------------------------------------------------------------
create table public.reposts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id),
  constraint reposts_note_length check (note is null or char_length(note) between 1 and 60)
);

create index reposts_post_idx on public.reposts (post_id);
create index reposts_user_created_idx on public.reposts (user_id, created_at desc);

alter table public.reposts enable row level security;

-- A repost shows on the reposter's profile: visible when both the profile and the post are.
create policy reposts_select_visible on public.reposts
  for select to authenticated
  using (public.can_view_profile(user_id) and public.can_view_post(post_id));
create policy reposts_insert_own on public.reposts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_post(post_id)
    and exists (
      select 1 from public.posts p
      join public.profiles a on a.id = p.author_id
      where p.id = post_id
        and p.status = 'published'
        and p.archived_at is null
        and p.audience = 'everyone'
        and not a.is_private
        and p.author_id <> (select auth.uid())
    )
  );
-- The note can be added / changed after reposting ("Add note").
create policy reposts_update_own on public.reposts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reposts_delete_own on public.reposts
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.reposts from anon, authenticated;
grant insert (post_id, note) on public.reposts to authenticated;
grant update (note) on public.reposts to authenticated;

create function public.reposts_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1 where id = new.post_id;
  else
    update public.posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger reposts_after_change
  after insert or delete on public.reposts
  for each row execute function public.reposts_after_change();

-- ---------------------------------------------------------------------------------------------
-- post_hides (Hide / Not interested / reported) and post_seen (ranking) — owner-only
-- ---------------------------------------------------------------------------------------------
create table public.post_hides (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  reason text not null default 'hidden',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id),
  constraint post_hides_reason_valid check (reason in ('hidden', 'not_interested', 'reported'))
);

create index post_hides_post_idx on public.post_hides (post_id);

alter table public.post_hides enable row level security;

create policy post_hides_select_own on public.post_hides
  for select to authenticated using (user_id = (select auth.uid()));
create policy post_hides_insert_own on public.post_hides
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy post_hides_delete_own on public.post_hides
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.post_hides from anon, authenticated;

create table public.post_seen (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index post_seen_post_idx on public.post_seen (post_id);

alter table public.post_seen enable row level security;

create policy post_seen_select_own on public.post_seen
  for select to authenticated using (user_id = (select auth.uid()));
create policy post_seen_insert_own on public.post_seen
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete on public.post_seen from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- reports (page 50). Write-only for clients except reading their own (support requests, p.108).
-- ---------------------------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  sub_reason text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_target_type_valid check (target_type in ('post', 'comment', 'profile')),
  constraint reports_reason_valid check (reason in (
    'dont_like', 'bullying', 'self_injury', 'violence_hate', 'restricted_items', 'nudity',
    'scam_spam', 'false_information', 'intellectual_property'
  )),
  constraint reports_sub_reason_length check (sub_reason is null or char_length(sub_reason) <= 80),
  constraint reports_status_valid check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  -- One report per person per target; a repeat is silently accepted (on conflict do nothing).
  constraint reports_once unique (reporter_id, target_type, target_id)
);

create index reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

create policy reports_select_own on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
create policy reports_insert_own on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (target_type, target_id, reason, sub_reason) on public.reports to authenticated;

-- Target must exist, be visible, and not be your own; a reported post leaves your feeds.
create function public.reports_before_insert()
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

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Post cards: everything a PostCard renders, for the viewer (invoker → RLS applies)
-- ---------------------------------------------------------------------------------------------
create function public.post_cards(p_ids uuid[])
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
        'audio_path', t.audio_path, 'duration_ms', t.duration_ms
      )
      from public.audio_tracks t where t.id = p.audio_track_id
    ),
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
-- Feeds (pages 43, 51). Pagination uses a snapshot time so ranking is stable while scrolling.
-- ---------------------------------------------------------------------------------------------

-- Home: followed authors (+ followed collaborators, own posts, reposts by people you follow)
-- from the last 3 days, ranked. After it ends the client shows "You're all caught up".
create function public.home_feed(
  p_snapshot timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 10
)
returns table (
  post_id uuid,
  reason text,
  reposted_by_id uuid,
  reposted_by_username text,
  repost_note text,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  followed as (
    select f.following_id as id from public.follows f, me where f.follower_id = me.id
  ),
  direct as (
    select p.id as post_id,
      case
        when p.author_id = (select id from me) then 'own'
        when exists (select 1 from public.favorites fv, me
                     where fv.owner_id = me.id and fv.favorite_id = p.author_id) then 'favorite'
        when p.author_id in (select id from followed) then 'following'
        else 'collab'
      end as reason,
      null::uuid as reposted_by_id, null::text as reposted_by_username, null::text as repost_note,
      p.published_at as at, p.author_id, p.like_count, p.comment_count
    from public.posts p
    where p.status = 'published'
      and p.archived_at is null
      and p.published_at <= p_snapshot
      and p.published_at > p_snapshot - interval '3 days'
      and (
        p.author_id = (select id from me)
        or p.author_id in (select id from followed)
        or exists (
          select 1 from public.post_collaborators c
          where c.post_id = p.id and c.status = 'accepted' and c.user_id in (select id from followed)
        )
      )
  ),
  shared as (
    select distinct on (r.post_id)
      r.post_id, 'repost' as reason, r.user_id as reposted_by_id, u.username as reposted_by_username,
      r.note as repost_note, r.created_at as at, p.author_id, p.like_count, p.comment_count
    from public.reposts r
    join public.posts p on p.id = r.post_id
    join public.profiles u on u.id = r.user_id
    where r.user_id in (select id from followed)
      and r.created_at <= p_snapshot
      and r.created_at > p_snapshot - interval '3 days'
      and p.author_id <> (select id from me)
      and r.post_id not in (select post_id from direct)
    order by r.post_id, r.created_at desc
  ),
  items as (
    select * from direct union all select * from shared
  )
  select i.post_id, i.reason, i.reposted_by_id, i.reposted_by_username, i.repost_note,
    (
      1.0 / power(1 + extract(epoch from (p_snapshot - i.at)) / 3600.0 / 6.0, 1.2)
      * (1 + ln(1 + i.like_count + 2 * i.comment_count) / 10.0)
      * case i.reason when 'favorite' then 1.6 when 'repost' then 0.8 else 1 end
      -- Your own post right after sharing sits on top.
      * case when i.reason = 'own' and i.at > p_snapshot - interval '1 hour' then 5 else 1 end
      -- Posts already seen before this session sink.
      * case when exists (
          select 1 from public.post_seen s, me
          where s.user_id = me.id and s.post_id = i.post_id and s.seen_at < p_snapshot
        ) then 0.2 else 1 end
    )::double precision as score
  from items i
  where public.can_view_post(i.post_id)
    and not exists (
      select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = i.post_id
    )
  order by score desc, i.at desc, i.post_id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 30);
$$;

-- Suggested posts after "You're all caught up": public posts from accounts you don't follow.
create function public.suggested_posts(
  p_snapshot timestamptz default now(),
  p_offset integer default 0,
  p_limit integer default 10
)
returns table (post_id uuid, score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id)
  select p.id,
    (
      ln(2 + p.like_count + 2 * p.comment_count + 3 * p.repost_count)
      / power(1 + extract(epoch from (p_snapshot - p.published_at)) / 3600.0 / 48.0, 1.1)
      * case when exists (
          select 1 from public.post_seen s, me
          where s.user_id = me.id and s.post_id = p.id and s.seen_at < p_snapshot
        ) then 0.3 else 1 end
      -- "Not interested" in an account's post → fewer posts from that account.
      * case when exists (
          select 1 from public.post_hides h join public.posts hp on hp.id = h.post_id, me
          where h.user_id = me.id and h.reason = 'not_interested' and hp.author_id = p.author_id
        ) then 0.2 else 1 end
    )::double precision as score
  from public.posts p
  join public.profiles a on a.id = p.author_id
  where p.status = 'published'
    and p.archived_at is null
    and p.audience = 'everyone'
    and not a.is_private
    and p.published_at <= p_snapshot
    and p.published_at > p_snapshot - interval '30 days'
    and p.author_id <> (select id from me)
    and not exists (
      select 1 from public.follows f, me where f.follower_id = me.id and f.following_id = p.author_id
    )
    and not exists (
      select 1 from public.follow_requests r, me
      where r.requester_id = me.id and r.target_id = p.author_id
    )
    and not exists (
      select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = p.id
    )
  order by score desc, p.published_at desc, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 30);
$$;

-- Page 51: chronological Following / Favorites feeds (keyset on published_at, then id).
create function public.following_feed(
  p_kind text default 'following',
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 10
)
returns table (post_id uuid, published_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  sources as (
    select f.following_id as id from public.follows f, me
    where p_kind = 'following' and f.follower_id = me.id
    union
    select fv.favorite_id from public.favorites fv, me
    where p_kind = 'favorites' and fv.owner_id = me.id
  )
  select p.id, p.published_at
  from public.posts p
  where p.status = 'published'
    and p.archived_at is null
    and (
      p.author_id in (select id from sources)
      or exists (
        select 1 from public.post_collaborators c
        where c.post_id = p.id and c.status = 'accepted' and c.user_id in (select id from sources)
      )
    )
    and (p_before is null or (p.published_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    and public.can_view_post(p.id)
    and not exists (
      select 1 from public.post_hides h, me where h.user_id = me.id and h.post_id = p.id
    )
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 30);
$$;

-- Feed impressions (ranking only). Ids the viewer can't see are ignored.
create function public.mark_posts_seen(p_ids uuid[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.post_seen (user_id, post_id)
  select auth.uid(), x.id
  from unnest(p_ids) as x(id)
  where public.can_view_post(x.id)
  on conflict (user_id, post_id) do nothing;
$$;

-- ---------------------------------------------------------------------------------------------
-- Comments (page 46)
-- ---------------------------------------------------------------------------------------------

-- p_kind: 'top' (pinned, then people you follow / yours, then most liked, newest),
--         'replies' (of p_parent, oldest first), 'hidden' (post author only).
create function public.post_comments(
  p_post uuid,
  p_kind text default 'top',
  p_parent uuid default null,
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  post_id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  username text,
  avatar_path text,
  like_count integer,
  reply_count integer,
  liked boolean,
  liked_by_post_author boolean,
  is_post_author boolean,
  is_pinned boolean,
  is_hidden boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.post_id, c.parent_id, c.body, c.created_at, c.author_id, u.username,
    u.avatar_path, c.like_count, c.reply_count,
    exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
    exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = p.author_id),
    c.author_id = p.author_id,
    c.pinned_at is not null,
    c.hidden_at is not null
  from public.comments c
  join public.posts p on p.id = c.post_id
  join public.profiles u on u.id = c.author_id
  where c.post_id = p_post
    and case p_kind
      when 'top' then c.parent_id is null
        and (c.hidden_at is null or (c.author_id = auth.uid() and p.author_id <> auth.uid()))
      when 'replies' then c.parent_id = p_parent
        and (c.hidden_at is null or (c.author_id = auth.uid() and p.author_id <> auth.uid()))
      when 'hidden' then c.hidden_at is not null and p.author_id = auth.uid()
      else false
    end
  order by
    case when p_kind = 'top' then c.pinned_at is not null end desc nulls last,
    case when p_kind = 'top' then c.pinned_at end asc nulls last,
    case when p_kind = 'top' then (c.author_id = auth.uid() and c.created_at > now() - interval '1 day')
      or exists (select 1 from public.follows f
                 where f.follower_id = auth.uid() and f.following_id = c.author_id) end desc nulls last,
    case when p_kind = 'top' then c.like_count end desc nulls last,
    case when p_kind = 'replies' then c.created_at end asc,
    c.created_at desc,
    c.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- Post author pins (≤3, top-level, not hidden) or unpins a comment.
create function public.set_comment_pinned(p_comment uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.comments;
begin
  select c.* into v_c from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and p.author_id = auth.uid()
  for update of c;
  if not found then
    raise exception 'comment_not_found' using errcode = 'P0002';
  end if;
  if not p_pinned then
    update public.comments set pinned_at = null where id = p_comment;
    return;
  end if;
  if v_c.parent_id is not null or v_c.hidden_at is not null then
    raise exception 'cannot_pin' using errcode = '22023';
  end if;
  if v_c.pinned_at is null and (
    select count(*) from public.comments where post_id = v_c.post_id and pinned_at is not null
  ) >= 3 then
    raise exception 'pin_limit' using errcode = '22023';
  end if;
  update public.comments set pinned_at = coalesce(pinned_at, now()) where id = p_comment;
end;
$$;

-- Post author hides / unhides a comment (hiding unpins it).
create function public.set_comment_hidden(p_comment uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments c
  set hidden_at = case when p_hidden then coalesce(c.hidden_at, now()) end,
      pinned_at = case when p_hidden then null else c.pinned_at end
  from public.posts p
  where c.id = p_comment and p.id = c.post_id and p.author_id = auth.uid();
  if not found then
    raise exception 'comment_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Likers (page 47): people you follow first, then newest; search by username / name
-- ---------------------------------------------------------------------------------------------
create function public.post_likers(
  p_post uuid,
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
  i_follow boolean,
  requested boolean,
  follows_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.username, u.full_name, u.avatar_path, u.is_private,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = u.id),
    exists (select 1 from public.follow_requests r
            where r.requester_id = auth.uid() and r.target_id = u.id),
    exists (select 1 from public.follows f where f.follower_id = u.id and f.following_id = auth.uid())
  from public.likes l
  join public.profiles u on u.id = l.user_id
  where l.post_id = p_post
    and (trim(coalesce(p_search, '')) = ''
         or u.username like lower(trim(p_search)) || '%'
         or u.full_name ilike '%' || trim(p_search) || '%')
  order by
    (u.id = auth.uid()) desc,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = u.id) desc,
    l.created_at desc,
    u.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

create function public.comment_likers(
  p_comment uuid,
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
  i_follow boolean,
  requested boolean,
  follows_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.username, u.full_name, u.avatar_path, u.is_private,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = u.id),
    exists (select 1 from public.follow_requests r
            where r.requester_id = auth.uid() and r.target_id = u.id),
    exists (select 1 from public.follows f where f.follower_id = u.id and f.following_id = auth.uid())
  from public.comment_likes l
  join public.profiles u on u.id = l.user_id
  where l.comment_id = p_comment
    and (trim(coalesce(p_search, '')) = ''
         or u.username like lower(trim(p_search)) || '%'
         or u.full_name ilike '%' || trim(p_search) || '%')
  order by
    (u.id = auth.uid()) desc,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = u.id) desc,
    l.created_at desc,
    u.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------------------------
-- Saved grids (pages 26/27): All posts (p_collection null) or one collection, newest first
-- ---------------------------------------------------------------------------------------------
create function public.saved_posts(
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
    coalesce(m.thumb_path, m.path), m.type,
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
-- profile_posts: + kind 'reposts' (profile Reposts tab)
-- ---------------------------------------------------------------------------------------------
create or replace function public.profile_posts(
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

-- ---------------------------------------------------------------------------------------------
-- Reserve the new route names (/feed/…, /report)
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
      'saved', 'settings', 'signup', 'stories', 'support', 'undefined', 'www'
    ]);
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.likes_after_change() from public, anon, authenticated;
revoke execute on function public.comments_before_insert() from public, anon, authenticated;
revoke execute on function public.comments_after_change() from public, anon, authenticated;
revoke execute on function public.comment_likes_after_change() from public, anon, authenticated;
revoke execute on function public.saves_after_delete() from public, anon, authenticated;
revoke execute on function public.saved_collection_items_before_insert() from public, anon, authenticated;
revoke execute on function public.reposts_after_change() from public, anon, authenticated;
revoke execute on function public.reports_before_insert() from public, anon, authenticated;
revoke execute on function public.is_valid_comment(text) from public, anon;
revoke execute on function public.post_cards(uuid[]) from public, anon;
revoke execute on function public.home_feed(timestamptz, integer, integer) from public, anon;
revoke execute on function public.suggested_posts(timestamptz, integer, integer) from public, anon;
revoke execute on function public.following_feed(text, timestamptz, uuid, integer) from public, anon;
revoke execute on function public.mark_posts_seen(uuid[]) from public, anon;
revoke execute on function public.post_comments(uuid, text, uuid, integer, integer) from public, anon;
revoke execute on function public.set_comment_pinned(uuid, boolean) from public, anon;
revoke execute on function public.set_comment_hidden(uuid, boolean) from public, anon;
revoke execute on function public.post_likers(uuid, text, integer, integer) from public, anon;
revoke execute on function public.comment_likers(uuid, text, integer, integer) from public, anon;
revoke execute on function public.saved_posts(uuid, integer, integer) from public, anon;

grant execute on function public.is_valid_comment(text) to authenticated;
grant execute on function public.post_cards(uuid[]) to authenticated;
grant execute on function public.home_feed(timestamptz, integer, integer) to authenticated;
grant execute on function public.suggested_posts(timestamptz, integer, integer) to authenticated;
grant execute on function public.following_feed(text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.mark_posts_seen(uuid[]) to authenticated;
grant execute on function public.post_comments(uuid, text, uuid, integer, integer) to authenticated;
grant execute on function public.set_comment_pinned(uuid, boolean) to authenticated;
grant execute on function public.set_comment_hidden(uuid, boolean) to authenticated;
grant execute on function public.post_likers(uuid, text, integer, integer) to authenticated;
grant execute on function public.comment_likers(uuid, text, integer, integer) to authenticated;
grant execute on function public.saved_posts(uuid, integer, integer) to authenticated;
