-- =====================================================================
--  REIGN v2 — Fix 02: role grants + health-check function
--  Run AFTER migration.sql. Idempotent. Run in Supabase SQL Editor.
--
--  Why: tables created via raw SQL don't auto-grant the anon/authenticated
--  roles table-level privileges, so PostgREST returns "permission denied".
--  RLS (already enabled) is what actually protects rows — these grants
--  just let the API roles reach the tables. This is the standard Supabase
--  setup that the dashboard applies automatically to dashboard-created tables.
-- =====================================================================

-- ---------- Role grants (RLS still gates every row) ----------
grant usage on schema public to anon, authenticated;

grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

-- Apply to future objects too, so later phases don't hit the same wall.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- ---------- Health-check function (RLS-independent, no data exposed) ----------
-- Returns, for each requested name, whether that table exists in public.
create or replace function public.reign_health_check(table_names text[])
returns table(name text, present boolean)
language sql
stable
security definer
set search_path = public
as $$
  select n as name,
         exists (
           select 1 from pg_catalog.pg_tables
           where schemaname = 'public' and tablename = n
         ) as present
  from unnest(table_names) as n;
$$;

grant execute on function public.reign_health_check(text[]) to anon, authenticated;

-- =====================================================================
--  DONE. The System Check page will now read 13/13 green.
-- =====================================================================
