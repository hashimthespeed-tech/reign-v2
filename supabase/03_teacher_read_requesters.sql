-- =====================================================================
--  REIGN v2 — Fix 03: let teachers read the profiles of students who
--  have REQUESTED their class (so pending join requests show real names).
--
--  Without this, profiles_select_teacher only matches students whose
--  profiles.class_id is already set — which only happens AFTER approval.
--  Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

drop policy if exists profiles_select_requesters on public.profiles;

create policy profiles_select_requesters on public.profiles
  for select using (
    exists (
      select 1
      from public.class_requests cr
      join public.classes c on c.id = cr.class_id
      where cr.student_id = profiles.id
        and c.teacher_id = auth.uid()
    )
  );

-- =====================================================================
--  DONE.
-- =====================================================================
