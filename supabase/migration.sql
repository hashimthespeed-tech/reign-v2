-- =====================================================================
--  REIGN v2 — Full database schema + RLS
--  Run this in the Supabase SQL Editor (one shot). Safe to re-run:
--  it drops/recreates policies and uses IF NOT EXISTS for tables.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- =====================================================================
--  TABLES
-- =====================================================================

-- profiles ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  investor_type text check (investor_type in
                 ('teacher','aggressive','cautious','long_term','no_idea')),
  class_id     uuid,                         -- FK added after classes exists
  school_name  text,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- classes -------------------------------------------------------------
create table if not exists public.classes (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  teacher_id          uuid references public.profiles(id) on delete cascade,
  class_code          text unique not null,
  starting_budget     numeric default 10000,
  account_type        text default 'standard'
                        check (account_type in ('standard','roth_ira','401k')),
  tax_enabled         boolean default false,
  require_predictions boolean default true,
  show_leaderboard    boolean default true,
  allow_short_selling boolean default false,
  thesis_required     boolean default false,
  show_real_money     boolean default true,
  school_name         text,
  semester_end_date   date,
  created_at          timestamptz default now()
);

-- profiles.class_id FK (added now that classes exists)
do $$ begin
  alter table public.profiles
    add constraint profiles_class_id_fkey
    foreign key (class_id) references public.classes(id) on delete set null;
exception when duplicate_object then null; end $$;

-- class_requests ------------------------------------------------------
create table if not exists public.class_requests (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  class_id   uuid references public.classes(id) on delete cascade,
  status     text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

-- portfolios ----------------------------------------------------------
create table if not exists public.portfolios (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  class_id     uuid references public.classes(id) on delete cascade,
  cash_balance numeric default 10000,
  created_at   timestamptz default now()
);

-- holdings ------------------------------------------------------------
create table if not exists public.holdings (
  id                uuid primary key default gen_random_uuid(),
  portfolio_id      uuid references public.portfolios(id) on delete cascade,
  ticker            text not null,
  company_name      text,
  shares            numeric default 0,
  avg_buy_price     numeric default 0,
  is_short          boolean default false,
  thesis            text,
  thesis_ai_response text,
  created_at        timestamptz default now()
);

-- predictions ---------------------------------------------------------
create table if not exists public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete cascade,
  class_id        uuid references public.classes(id) on delete cascade,
  ticker          text not null,
  direction       text not null check (direction in ('up','down')),
  prediction_date date not null,
  opening_price   numeric,
  closing_price   numeric,
  result          text check (result in ('correct','incorrect')),
  created_at      timestamptz default now(),
  unique (user_id, prediction_date)
);

-- trades --------------------------------------------------------------
create table if not exists public.trades (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid references public.portfolios(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete cascade,
  ticker         text not null,
  company_name   text,
  trade_type     text check (trade_type in ('buy','sell','short','cover')),
  shares         numeric not null,
  price_at_trade numeric not null,
  total_value    numeric not null,
  thesis         text,
  traded_at      timestamptz default now(),
  trade_date     date not null
);

-- daily_reports -------------------------------------------------------
create table if not exists public.daily_reports (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references public.profiles(id) on delete cascade,
  class_id               uuid references public.classes(id) on delete cascade,
  report_date            date not null,
  report_text            text,
  hero_ticker            text,
  villain_ticker         text,
  unresolved_story       text,
  concept_name           text,
  concept_definition     text,
  portfolio_value_at_close numeric,
  day_change_dollars     numeric,
  day_change_percentage  numeric,
  created_at             timestamptz default now(),
  unique (user_id, report_date)
);

-- monthly_reports -----------------------------------------------------
create table if not exists public.monthly_reports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete cascade,
  class_id            uuid references public.classes(id) on delete cascade,
  report_month        date not null,
  report_text         text,
  behavioral_patterns jsonb,
  what_if_scenarios   jsonb,
  prediction_accuracy numeric,
  portfolio_start_value numeric,
  portfolio_end_value numeric,
  created_at          timestamptz default now(),
  unique (user_id, report_month)
);

-- concepts ------------------------------------------------------------
create table if not exists public.concepts (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  plain_english_name text not null,
  hook               text,
  content            text,
  category           text check (category in ('basics','strategy','psychology','macro','analysis')),
  unlock_requirement text check (unlock_requirement in ('day_1','day_10','day_30','rank_1')),
  created_at         timestamptz default now()
);

-- student_concepts ----------------------------------------------------
create table if not exists public.student_concepts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  concept_id   uuid references public.concepts(id) on delete cascade,
  unlocked_at  timestamptz,
  completed_at timestamptz,
  created_at   timestamptz default now(),
  unique (user_id, concept_id)
);

-- unlocks -------------------------------------------------------------
create table if not exists public.unlocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  unlock_type  text check (unlock_type in ('day_10','day_30','rank_1','semester_end')),
  unlocked_at  timestamptz default now(),
  seen_by_user boolean default false,
  unique (user_id, unlock_type)
);

-- class_narratives ----------------------------------------------------
create table if not exists public.class_narratives (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid references public.classes(id) on delete cascade,
  narrative_date date not null,
  narrative_text text,
  created_at     timestamptz default now(),
  unique (class_id, narrative_date)
);

-- ---------- Indexes ----------
create index if not exists idx_profiles_class       on public.profiles(class_id);
create index if not exists idx_classes_teacher      on public.classes(teacher_id);
create index if not exists idx_classes_code         on public.classes(class_code);
create index if not exists idx_requests_class       on public.class_requests(class_id);
create index if not exists idx_requests_student     on public.class_requests(student_id);
create index if not exists idx_portfolios_user      on public.portfolios(user_id);
create index if not exists idx_portfolios_class     on public.portfolios(class_id);
create index if not exists idx_holdings_portfolio   on public.holdings(portfolio_id);
create index if not exists idx_predictions_user     on public.predictions(user_id);
create index if not exists idx_predictions_class    on public.predictions(class_id);
create index if not exists idx_trades_portfolio     on public.trades(portfolio_id);
create index if not exists idx_trades_user          on public.trades(user_id);
create index if not exists idx_daily_user           on public.daily_reports(user_id);
create index if not exists idx_monthly_user         on public.monthly_reports(user_id);
create index if not exists idx_studconcepts_user    on public.student_concepts(user_id);
create index if not exists idx_unlocks_user         on public.unlocks(user_id);
create index if not exists idx_narratives_class     on public.class_narratives(class_id);

-- =====================================================================
--  HELPER FUNCTION — username availability (SECURITY DEFINER)
--  Lets onboarding check uniqueness without exposing profile rows.
-- =====================================================================
create or replace function public.username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(check_username)
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.classes          enable row level security;
alter table public.class_requests   enable row level security;
alter table public.portfolios       enable row level security;
alter table public.holdings         enable row level security;
alter table public.predictions      enable row level security;
alter table public.trades           enable row level security;
alter table public.daily_reports    enable row level security;
alter table public.monthly_reports  enable row level security;
alter table public.concepts         enable row level security;
alter table public.student_concepts enable row level security;
alter table public.unlocks          enable row level security;
alter table public.class_narratives enable row level security;

-- Drop any existing policies (clean re-run) -------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_teacher on public.profiles
  for select using (exists (
    select 1 from public.classes c
    where c.teacher_id = auth.uid() and c.id = profiles.class_id));
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- classes ----------
create policy classes_select_all on public.classes
  for select to authenticated using (true);
create policy classes_insert_teacher on public.classes
  for insert to authenticated with check (teacher_id = auth.uid());
create policy classes_update_teacher on public.classes
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ---------- class_requests ----------
create policy requests_insert_student on public.class_requests
  for insert with check (student_id = auth.uid());
create policy requests_select_student on public.class_requests
  for select using (student_id = auth.uid());
create policy requests_select_teacher on public.class_requests
  for select using (exists (
    select 1 from public.classes c
    where c.id = class_requests.class_id and c.teacher_id = auth.uid()));
create policy requests_update_teacher on public.class_requests
  for update using (exists (
    select 1 from public.classes c
    where c.id = class_requests.class_id and c.teacher_id = auth.uid()));

-- ---------- portfolios ----------
create policy portfolios_all_own on public.portfolios
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy portfolios_select_teacher on public.portfolios
  for select using (exists (
    select 1 from public.classes c
    where c.id = portfolios.class_id and c.teacher_id = auth.uid()));

-- ---------- holdings ----------
create policy holdings_all_own on public.holdings
  for all using (exists (
    select 1 from public.portfolios p
    where p.id = holdings.portfolio_id and p.user_id = auth.uid()))
  with check (exists (
    select 1 from public.portfolios p
    where p.id = holdings.portfolio_id and p.user_id = auth.uid()));
create policy holdings_select_teacher on public.holdings
  for select using (exists (
    select 1 from public.portfolios p
    join public.classes c on c.id = p.class_id
    where p.id = holdings.portfolio_id and c.teacher_id = auth.uid()));

-- ---------- predictions (immutable to clients) ----------
create policy predictions_insert_own on public.predictions
  for insert with check (user_id = auth.uid());
create policy predictions_select_own on public.predictions
  for select using (user_id = auth.uid());
create policy predictions_select_teacher on public.predictions
  for select using (exists (
    select 1 from public.classes c
    where c.id = predictions.class_id and c.teacher_id = auth.uid()));

-- ---------- trades (immutable) ----------
create policy trades_insert_own on public.trades
  for insert with check (user_id = auth.uid());
create policy trades_select_own on public.trades
  for select using (user_id = auth.uid());
create policy trades_select_teacher on public.trades
  for select using (exists (
    select 1 from public.portfolios p
    join public.classes c on c.id = p.class_id
    where p.id = trades.portfolio_id and c.teacher_id = auth.uid()));

-- ---------- daily_reports ----------
-- v1: student may insert own (in-browser generation). Phase 17 -> server-only.
create policy daily_insert_own on public.daily_reports
  for insert with check (user_id = auth.uid());
create policy daily_select_own on public.daily_reports
  for select using (user_id = auth.uid());
create policy daily_select_teacher on public.daily_reports
  for select using (exists (
    select 1 from public.classes c
    where c.id = daily_reports.class_id and c.teacher_id = auth.uid()));

-- ---------- monthly_reports ----------
create policy monthly_insert_own on public.monthly_reports
  for insert with check (user_id = auth.uid());
create policy monthly_select_own on public.monthly_reports
  for select using (user_id = auth.uid());
create policy monthly_select_teacher on public.monthly_reports
  for select using (exists (
    select 1 from public.classes c
    where c.id = monthly_reports.class_id and c.teacher_id = auth.uid()));

-- ---------- concepts (read-only catalog) ----------
create policy concepts_select_all on public.concepts
  for select to authenticated using (true);

-- ---------- student_concepts ----------
create policy studconcepts_all_own on public.student_concepts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- unlocks ----------
create policy unlocks_all_own on public.unlocks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- class_narratives ----------
create policy narratives_select_member on public.class_narratives
  for select using (
    exists (select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.class_id = class_narratives.class_id)
    or exists (select 1 from public.classes c
            where c.id = class_narratives.class_id and c.teacher_id = auth.uid()));
-- v1: teacher may insert narratives for their class. Phase 17 -> server-only.
create policy narratives_insert_teacher on public.class_narratives
  for insert with check (exists (
    select 1 from public.classes c
    where c.id = class_narratives.class_id and c.teacher_id = auth.uid()));

-- =====================================================================
--  DONE.  Verify with:  select count(*) from public.classes;
-- =====================================================================
