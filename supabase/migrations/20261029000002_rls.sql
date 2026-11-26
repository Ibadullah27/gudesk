create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select coalesce(public.current_role() = 'admin', false) $$;

create or replace function public.teaches_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.courses c
    where c.id = target_course_id and c.teacher_id = (select auth.uid())
      and public.current_role() = 'teacher'
  )
$$;

create or replace function public.is_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.enrollments e
    where e.course_id = target_course_id and e.student_id = (select auth.uid())
      and public.current_role() = 'student'
  )
$$;

revoke all on function public.current_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.teaches_course(uuid) from public;
revoke all on function public.is_enrolled(uuid) from public;
grant execute on function public.current_role(), public.is_admin(), public.teaches_course(uuid), public.is_enrolled(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.resources enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.chat_messages enable row level security;
alter table public.complaints enable row level security;

-- Remove broad default grants; only the operations below are available to browser roles.
revoke all on public.profiles, public.courses, public.enrollments, public.resources,
  public.assignments, public.submissions, public.quizzes, public.quiz_questions,
  public.quiz_attempts, public.announcements, public.chat_messages, public.complaints
  from anon, authenticated;
grant select on public.profiles, public.courses, public.enrollments, public.resources,
  public.assignments, public.submissions, public.quizzes, public.quiz_attempts,
  public.announcements, public.chat_messages, public.complaints to authenticated;
grant select on public.quiz_questions to authenticated;
grant select on public.marks_overview to authenticated;
grant insert, update, delete on public.courses, public.enrollments, public.resources,
  public.assignments, public.quizzes, public.quiz_questions, public.announcements to authenticated;
grant insert (course_id, sender_id, body) on public.chat_messages to authenticated;
grant insert (quiz_id, student_id, answers), update (answers) on public.quiz_attempts to authenticated;
grant insert (raised_by, course_id, category, subject, description) on public.complaints to authenticated;
grant update (status, admin_response, resolved_by, updated_at) on public.complaints to authenticated;

create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid()) or public.is_admin() or exists (
    select 1 from public.courses c
    join public.enrollments e on e.course_id = c.id
    where c.teacher_id = (select auth.uid()) and e.student_id = profiles.id
  )
);
create policy profiles_self_password_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_insert on public.profiles for insert to authenticated
with check (public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy courses_select on public.courses for select to authenticated
using (public.is_admin() or (public.current_role() = 'teacher' and teacher_id = (select auth.uid())) or public.is_enrolled(id));
create policy courses_admin_insert on public.courses for insert to authenticated
with check (public.is_admin());
create policy courses_admin_update on public.courses for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy courses_admin_delete on public.courses for delete to authenticated
using (public.is_admin());

create policy enrollments_select on public.enrollments for select to authenticated
using (public.is_admin() or (public.current_role() = 'student' and student_id = (select auth.uid())) or public.teaches_course(course_id));
create policy enrollments_insert on public.enrollments for insert to authenticated
with check (
  (public.is_admin() or public.teaches_course(course_id)) and
  exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.is_active)
);
create policy enrollments_delete on public.enrollments for delete to authenticated
using (public.is_admin() or public.teaches_course(course_id));

create policy resources_select on public.resources for select to authenticated
using (public.is_admin() or public.teaches_course(course_id) or public.is_enrolled(course_id));
create policy resources_insert on public.resources for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.teaches_course(course_id));
create policy resources_delete on public.resources for delete to authenticated
using (uploaded_by = (select auth.uid()) and public.teaches_course(course_id));

create policy assignments_select on public.assignments for select to authenticated
using (public.is_admin() or public.teaches_course(course_id) or public.is_enrolled(course_id));
create policy assignments_insert on public.assignments for insert to authenticated
with check (created_by = (select auth.uid()) and public.teaches_course(course_id));
create policy assignments_update on public.assignments for update to authenticated
using (public.teaches_course(course_id)) with check (public.teaches_course(course_id));
create policy assignments_delete on public.assignments for delete to authenticated
using (public.teaches_course(course_id));

create policy submissions_select on public.submissions for select to authenticated
using (
  (public.current_role() = 'student' and student_id = (select auth.uid())) or exists (
    select 1 from public.assignments a where a.id = assignment_id and public.teaches_course(a.course_id)
  )
);
create policy submissions_student_insert on public.submissions for insert to authenticated
with check (
  public.current_role() = 'student' and student_id = (select auth.uid()) and exists (
    select 1 from public.assignments a
    where a.id = assignment_id and public.is_enrolled(a.course_id)
      and (a.allow_late or now() <= a.due_at)
  )
);
create policy submissions_student_update on public.submissions for update to authenticated
using (
  public.current_role() = 'student' and student_id = (select auth.uid()) and exists (
    select 1 from public.assignments a
    where a.id = assignment_id and (a.allow_late or now() <= a.due_at)
  )
)
with check (
  public.current_role() = 'student' and student_id = (select auth.uid()) and exists (
    select 1 from public.assignments a
    where a.id = assignment_id and (a.allow_late or now() <= a.due_at)
  )
);
create policy submissions_teacher_grade on public.submissions for update to authenticated
using (exists (
  select 1 from public.assignments a where a.id = assignment_id and public.teaches_course(a.course_id)
))
with check (exists (
  select 1 from public.assignments a where a.id = assignment_id and public.teaches_course(a.course_id)
));

create or replace function public.submit_assignment(
  target_assignment_id uuid,
  submission_file_path text default null,
  answer_text text default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_record public.assignments;
  saved_submission public.submissions;
begin
  select * into assignment_record from public.assignments a where a.id = target_assignment_id;
  if not found or public.current_role() <> 'student' or not public.is_enrolled(assignment_record.course_id) then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;
  if now() > assignment_record.due_at and not assignment_record.allow_late then
    raise exception 'The submission deadline has passed' using errcode = '42501';
  end if;
  insert into public.submissions (assignment_id, student_id, file_path, text_answer)
  values (target_assignment_id, (select auth.uid()), submission_file_path, answer_text)
  on conflict (assignment_id, student_id) do update
    set file_path = excluded.file_path, text_answer = excluded.text_answer
  returning * into saved_submission;
  return saved_submission;
end;
$$;
revoke all on function public.submit_assignment(uuid, text, text) from public;
grant execute on function public.submit_assignment(uuid, text, text) to authenticated;

create policy quizzes_select on public.quizzes for select to authenticated
using (public.teaches_course(course_id) or (is_published and public.is_enrolled(course_id)));
create policy quizzes_insert on public.quizzes for insert to authenticated
with check (created_by = (select auth.uid()) and public.teaches_course(course_id));
create policy quizzes_update on public.quizzes for update to authenticated
using (public.teaches_course(course_id)) with check (public.teaches_course(course_id));
create policy quizzes_delete on public.quizzes for delete to authenticated
using (public.teaches_course(course_id));

create policy quiz_questions_teacher_select on public.quiz_questions for select to authenticated
using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)));
create policy quiz_questions_teacher_insert on public.quiz_questions for insert to authenticated
with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)));
create policy quiz_questions_teacher_update on public.quiz_questions for update to authenticated
using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)))
with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)));
create policy quiz_questions_teacher_delete on public.quiz_questions for delete to authenticated
using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)));

create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
using (
  (public.current_role() = 'student' and student_id = (select auth.uid())) or exists (
    select 1 from public.quizzes q where q.id = quiz_id and public.teaches_course(q.course_id)
  )
);
create policy quiz_attempts_insert on public.quiz_attempts for insert to authenticated
with check (
  public.current_role() = 'student' and student_id = (select auth.uid()) and exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.is_published and public.is_enrolled(q.course_id)
      and now() between q.opens_at and q.closes_at
  )
);
create policy quiz_attempts_student_update on public.quiz_attempts for update to authenticated
using (
  public.current_role() = 'student' and student_id = (select auth.uid()) and submitted_at is null and exists (
    select 1 from public.quizzes q where q.id = quiz_id
      and now() <= least(started_at + make_interval(mins => q.duration_minutes), q.closes_at)
  )
)
with check (public.current_role() = 'student' and student_id = (select auth.uid()));

create policy announcements_select on public.announcements for select to authenticated
using (
  public.current_role() is not null and
  (course_id is null or public.is_admin() or public.teaches_course(course_id) or public.is_enrolled(course_id))
);
create policy announcements_insert on public.announcements for insert to authenticated
with check (
  author_id = (select auth.uid()) and
  ((course_id is null and public.is_admin()) or (course_id is not null and public.teaches_course(course_id)))
);
create policy announcements_update on public.announcements for update to authenticated
using (author_id = (select auth.uid()) and (public.is_admin() or (course_id is not null and public.teaches_course(course_id))))
with check (author_id = (select auth.uid()) and (public.is_admin() or (course_id is not null and public.teaches_course(course_id))));
create policy announcements_delete on public.announcements for delete to authenticated
using (author_id = (select auth.uid()) and (public.is_admin() or (course_id is not null and public.teaches_course(course_id))));

create policy chat_messages_select on public.chat_messages for select to authenticated
using (public.is_admin() or public.teaches_course(course_id) or public.is_enrolled(course_id));
create policy chat_messages_insert on public.chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid()) and
  (public.teaches_course(course_id) or public.is_enrolled(course_id))
);
create policy chat_messages_teacher_delete on public.chat_messages for delete to authenticated
using (public.is_admin() or public.teaches_course(course_id));
grant delete on public.chat_messages to authenticated;

alter table public.chat_messages replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

create or replace function public.set_submission_server_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_due_at timestamptz;
begin
  select a.due_at into assignment_due_at
  from public.assignments a where a.id = new.assignment_id;
  if assignment_due_at is null then
    raise exception 'Assignment not found' using errcode = '23503';
  end if;
  new.submitted_at := clock_timestamp();
  new.is_late := new.submitted_at > assignment_due_at;
  new.marks_obtained := null;
  new.feedback := null;
  new.graded_by := null;
  new.graded_at := null;
  return new;
end;
$$;
revoke all on function public.set_submission_server_fields() from public;
create trigger submissions_server_timestamps
before insert or update of file_path, text_answer on public.submissions
for each row execute function public.set_submission_server_fields();

create or replace function public.grade_submission(
  target_submission_id uuid,
  awarded_marks numeric,
  teacher_feedback text default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_submission public.submissions;
  maximum_marks numeric;
begin
  select a.total_marks into maximum_marks
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = target_submission_id and public.teaches_course(a.course_id);
  if maximum_marks is null then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if awarded_marks < 0 or awarded_marks > maximum_marks then
    raise exception 'Marks must be between 0 and total marks' using errcode = '22023';
  end if;
  update public.submissions
  set marks_obtained = awarded_marks,
      feedback = teacher_feedback,
      graded_by = (select auth.uid()),
      graded_at = now()
  where id = target_submission_id
  returning * into updated_submission;
  return updated_submission;
end;
$$;
revoke all on function public.grade_submission(uuid, numeric, text) from public;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

create policy complaints_select on public.complaints for select to authenticated
using ((public.current_role() in ('student', 'teacher') and raised_by = (select auth.uid())) or public.is_admin());
create policy complaints_insert on public.complaints for insert to authenticated
with check (
  raised_by = (select auth.uid()) and public.current_role() in ('student', 'teacher') and
  (course_id is null or public.teaches_course(course_id) or public.is_enrolled(course_id))
);
create policy complaints_admin_update on public.complaints for update to authenticated
using (public.is_admin()) with check (public.is_admin());
