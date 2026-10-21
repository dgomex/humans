-- Phase 9 follow-up: when a group loses its last admin, promote the longest-standing member,
-- breaking ties (people added together) by who accepted first, then by id.
create or replace function public.ensure_thread_admin(p_thread uuid)
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
      order by joined_at, accepted_at nulls last, user_id limit 1
    );
  end if;
end;
$$;

revoke execute on function public.ensure_thread_admin(uuid) from public, anon, authenticated;
