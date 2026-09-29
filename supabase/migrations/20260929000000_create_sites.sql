-- classfolio: gallery of student personal websites.
-- Permissions are enforced here (RLS + column grants), not by the UI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sites (
  id             uuid primary key default gen_random_uuid(),
  creator_name   text not null check (length(trim(creator_name)) between 1 and 80),
  site_url       text not null check (site_url ~* '^https?://' and length(site_url) <= 300),
  github_url     text null     check (github_url is null or (github_url ~* '^https?://' and length(github_url) <= 300)),
  screenshot_url text null     check (screenshot_url is null or (screenshot_url ~* '^https?://' and length(screenshot_url) <= 1000)),
  -- Honeypot: the form's hidden field is sent here. People never fill it; bots do. Any value is rejected.
  honeypot       text null     check (honeypot is null or honeypot = ''),
  created_at     timestamptz not null default now()
);

create index sites_created_at_idx on public.sites (created_at desc);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- security definer so policies on `sites` can consult `admins` regardless of its own RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.sites enable row level security;
alter table public.admins enable row level security;

-- Anyone can browse.
create policy "sites are public"
  on public.sites for select
  to anon, authenticated
  using (true);

-- Anyone can submit (validated by the check constraints above).
create policy "anyone can submit a site"
  on public.sites for insert
  to anon, authenticated
  with check (true);

-- Only admins can edit or remove.
create policy "admins can update sites"
  on public.sites for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admins can delete sites"
  on public.sites for delete
  to authenticated
  using ((select public.is_admin()));

-- A signed-in user can read only their own admins row ("am I an admin?").
create policy "users can see their own admin row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies on admins: manage it from the dashboard / SQL editor.

-- ---------------------------------------------------------------------------
-- Column privileges
-- Visitors may only supply the form fields: not id, created_at (so nobody can pin themselves
-- to the top), or screenshot_url (so nobody can inject an arbitrary image).
-- ---------------------------------------------------------------------------

revoke insert, update on public.sites from anon, authenticated;
grant insert (creator_name, site_url, github_url, honeypot) on public.sites to anon, authenticated;
grant update (creator_name, site_url, github_url, screenshot_url) on public.sites to authenticated;

revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new submissions appear for everyone without a refresh.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.sites;
