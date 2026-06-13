-- =====================================================================
--  REIGN v2 — 05: grant table access to service_role
--  Run in Supabase SQL Editor. Idempotent.
--
--  service_role bypasses RLS but still needs table-level GRANTs. Our tables
--  were created via raw SQL, so (like anon/authenticated in fix 02) the
--  service_role grant wasn't applied automatically. Server-side functions
--  (prediction resolution, report/narrative generation, cron) need this.
-- =====================================================================

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- =====================================================================
--  DONE.
-- =====================================================================
