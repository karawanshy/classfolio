-- Live reaction counts, and no reacting for admins.
--
-- Every change now goes through set_reaction(). It serializes changes per (site, reaction), returns the
-- exact new total with a version, and broadcasts the same total on the public Realtime channel
-- "site_reactions". Broadcasts carry only totals, never who reacted: each visitor's own rows stay
-- private to them (user_id = their anonymous auth.uid()).

drop policy if exists "users can add their own reactions" on public.site_reactions;
drop policy if exists "users can remove their own reactions" on public.site_reactions;
revoke insert, delete on public.site_reactions from anon, authenticated;

create or replace function public.set_reaction(p_site_id uuid, p_reaction text, p_on boolean)
returns table (total integer, version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
  v bigint;
begin
  if uid is null then
    raise exception 'Sign in to react' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'Admins can''t react' using errcode = '42501';
  end if;

  -- One change at a time per site and reaction, so each total is exact and versions follow commit order.
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_reaction, 0));

  if p_on then
    insert into public.site_reactions (site_id, user_id, reaction)
    values (p_site_id, uid, p_reaction)
    on conflict do nothing;
  else
    delete from public.site_reactions r
    where r.site_id = p_site_id and r.user_id = uid and r.reaction = p_reaction;
  end if;

  select count(*)::integer into n
  from public.site_reactions r
  where r.site_id = p_site_id and r.reaction = p_reaction;

  -- Microseconds since the epoch: clients keep the newest total they've seen for each reaction.
  v := (extract(epoch from clock_timestamp()) * 1000000)::bigint;

  perform realtime.send(
    jsonb_build_object('site_id', p_site_id, 'reaction', p_reaction, 'count', n, 'version', v),
    'count',
    'site_reactions',
    false -- public channel: anyone viewing the gallery receives it
  );

  return query select n, v;
end;
$$;

revoke all on function public.set_reaction(uuid, text, boolean) from public, anon;
grant execute on function public.set_reaction(uuid, text, boolean) to authenticated;
