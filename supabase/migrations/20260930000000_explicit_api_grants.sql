-- Newer Supabase projects can be created without default table privileges for the API roles
-- ("automatically expose new tables" off). Grant exactly what the app needs explicitly, so the
-- schema works either way. Row Level Security still decides which rows each role can touch.

grant usage on schema public to anon, authenticated;

grant select on public.sites to anon, authenticated;
grant insert (creator_name, site_url, github_url, honeypot) on public.sites to anon, authenticated;
grant update (creator_name, site_url, github_url, screenshot_url) on public.sites to authenticated;
grant delete on public.sites to authenticated;

grant select on public.admins to authenticated;
