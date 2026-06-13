-- =====================================================================
--  REIGN v2 — 06: full leaderboard data (no holdings exposed)
--  Run in Supabase SQL Editor. Idempotent.
--
--  Returns, for each member of the caller's class: current value, value ~7d
--  ago (from daily_reports), all-time prediction results (ordered, for
--  accuracy + streak), this-week prediction tallies (for champion), and join
--  date (for rival matching). Username + stats only — never holdings.
-- =====================================================================

create or replace function public.class_leaderboard()
returns table(
  user_id uuid,
  username text,
  value numeric,
  week_ago_value numeric,
  pred_results text[],
  week_correct bigint,
  week_total bigint,
  joined_at timestamptz
)
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
  select
    p.user_id,
    pr.username,
    coalesce(p.last_value, p.cash_balance) as value,
    (select dr.portfolio_value_at_close from public.daily_reports dr
       where dr.user_id = p.user_id and dr.report_date <= current_date - 7
       order by dr.report_date desc limit 1) as week_ago_value,
    coalesce((select array_agg(pp.result order by pp.prediction_date desc)
       from public.predictions pp
       where pp.user_id = p.user_id and pp.result is not null), '{}') as pred_results,
    (select count(*) from public.predictions pp
       where pp.user_id = p.user_id and pp.result = 'correct'
         and pp.prediction_date >= current_date - 7) as week_correct,
    (select count(*) from public.predictions pp
       where pp.user_id = p.user_id and pp.result is not null
         and pp.prediction_date >= current_date - 7) as week_total,
    p.created_at as joined_at
  from public.portfolios p
  join public.profiles pr on pr.id = p.user_id
  where p.class_id = (select class_id from target)
  order by value desc, pr.username asc;
$$;

grant execute on function public.class_leaderboard() to authenticated;

-- =====================================================================
--  DONE.
-- =====================================================================
