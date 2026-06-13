-- =====================================================================
--  REIGN v2 — 04: class standings (rank) without exposing holdings
--  Run in Supabase SQL Editor. Idempotent.
--
--  Students can't read classmates' portfolios under RLS (by design).
--  Each student stores their own live-computed value in last_value;
--  this SECURITY DEFINER fn returns only {username, value} for the
--  caller's own class so rank can be computed without leaking holdings.
-- =====================================================================

alter table public.portfolios add column if not exists last_value    numeric;
alter table public.portfolios add column if not exists last_value_at timestamptz;

create or replace function public.class_standings()
returns table(user_id uuid, username text, value numeric)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select class_id, investor_type from public.profiles where id = auth.uid()
  ),
  target as (
    select coalesce(
      (select class_id from me where investor_type is distinct from 'teacher'),
      (select id from public.classes where teacher_id = auth.uid() order by created_at limit 1)
    ) as class_id
  )
  select p.user_id, pr.username, coalesce(p.last_value, p.cash_balance) as value
  from public.portfolios p
  join public.profiles pr on pr.id = p.user_id
  where p.class_id = (select class_id from target)
  order by value desc, pr.username asc;
$$;

grant execute on function public.class_standings() to authenticated;

-- =====================================================================
--  DONE.
-- =====================================================================
