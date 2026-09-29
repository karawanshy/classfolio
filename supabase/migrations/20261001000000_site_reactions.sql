-- Reactions: small compliments visitors can give a site (several per site, each removable).
-- Visitors get a stable auth.uid() through Supabase anonymous sign-in, made on their first reaction.

create table public.site_reactions (
  site_id    uuid        not null references public.sites (id) on delete cascade,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  reaction   text        not null check (reaction in ('beautiful', 'story', 'creative', 'ux', 'professional', 'memorable')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id, reaction)
);

-- "My reactions" filters by user_id.
create index site_reactions_user_id_idx on public.site_reactions (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Rows are private to their author (they carry a user id); everyone reads the totals through
-- site_reaction_counts() below instead.
-- ---------------------------------------------------------------------------

alter table public.site_reactions enable row level security;

create policy "users can see their own reactions"
  on public.site_reactions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users can add their own reactions"
  on public.site_reactions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users can remove their own reactions"
  on public.site_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Public counts
-- security definer so anyone can read the aggregate without seeing who reacted.
-- ---------------------------------------------------------------------------

create or replace function public.site_reaction_counts()
returns table (site_id uuid, reaction text, count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.site_id, r.reaction, count(*)::integer
  from public.site_reactions r
  group by r.site_id, r.reaction;
$$;

revoke all on function public.site_reaction_counts() from public;
grant execute on function public.site_reaction_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges (explicit, as in 20260930000000_explicit_api_grants.sql)
-- Visitors supply only the site and the reaction: user_id always defaults to auth.uid().
-- ---------------------------------------------------------------------------

revoke all on public.site_reactions from anon, authenticated;
grant select, delete on public.site_reactions to authenticated;
grant insert (site_id, reaction) on public.site_reactions to authenticated;
