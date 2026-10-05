-- Phase 0 — Storage buckets (S3 simulation) + baseline storage RLS.
--
-- Path convention: the FIRST path segment is the owner (auth.uid()) for every bucket except
-- `messages`, whose first segment is the thread id. See docs/ARCHITECTURE.md → Storage.
--
-- Baseline here = owners manage their own objects. Read access for OTHER users is added by the
-- phase that owns the related table (it needs follows/privacy/thread membership to decide):
--   posts   → Phase 3 (posts) + Phase 2 (follows, private accounts)
--   reels   → Phase 6
--   stories → Phase 5 (24h expiry, close friends)
--   messages→ Phase 9 (thread participants) — no policies yet = deny all
-- Public buckets (avatars, highlights-covers) are readable by anyone via their public URL.

-- ---------------------------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',           'avatars',           true,  5242880,   array['image/jpeg','image/png','image/webp','image/heic']),
  ('posts',             'posts',             false, 104857600, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('reels',             'reels',             false, 104857600, array['video/mp4','video/quicktime','image/jpeg','image/png','image/webp']),
  ('stories',           'stories',           false, 52428800,  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('messages',          'messages',          false, 52428800,  array['image/jpeg','image/png','image/webp','image/heic','image/gif','video/mp4','video/quicktime','audio/mp4','audio/m4a','audio/aac','audio/mpeg']),
  ('highlights-covers', 'highlights-covers', true,  5242880,   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------------------
-- Owner policies (avatars, posts, reels, stories, highlights-covers)
-- Policy names follow <table>_<action>_<who>, prefixed by bucket since they share storage.objects.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  b text;
begin
  foreach b in array array['avatars','posts','reels','stories','highlights-covers'] loop
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_select_owner', b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_insert_owner', b);
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
         with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_update_owner', b, b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_delete_owner', b);
  end loop;
end
$$;
