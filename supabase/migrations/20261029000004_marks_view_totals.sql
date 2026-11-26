create or replace function public.quiz_total_marks(target_quiz_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(qq.marks), 0)
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where q.id = target_quiz_id
    and (
      public.is_admin()
      or public.teaches_course(q.course_id)
      or (
        public.is_enrolled(q.course_id)
        and (
          q.is_published
          or exists (
            select 1 from public.quiz_attempts qa
            where qa.quiz_id = q.id and qa.student_id = (select auth.uid())
          )
        )
      )
    )
$$;

revoke all on function public.quiz_total_marks(uuid) from public, anon;
grant execute on function public.quiz_total_marks(uuid) to authenticated;

create or replace view public.marks_overview with (security_invoker = true) as
select s.student_id, a.course_id, 'assignment'::text as kind, a.id as item_id,
       a.title, s.marks_obtained as obtained, a.total_marks as total, s.graded_at
from public.submissions s
join public.assignments a on a.id = s.assignment_id
where s.marks_obtained is not null
union all
select qa.student_id, q.course_id, 'quiz'::text as kind, q.id as item_id,
       q.title, qa.score as obtained, public.quiz_total_marks(q.id) as total,
       qa.submitted_at as graded_at
from public.quiz_attempts qa
join public.quizzes q on q.id = qa.quiz_id
where qa.score is not null;
