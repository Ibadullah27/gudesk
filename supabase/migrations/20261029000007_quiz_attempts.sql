-- Atomic quiz attempt lifecycle. These functions use the caller's identity and
-- server time so clients cannot extend deadlines or submit another student's work.
create or replace function public.start_quiz_attempt(target_quiz_id uuid)
returns public.quiz_attempts
language plpgsql security definer set search_path = public
as $$
declare quiz_row public.quizzes; saved public.quiz_attempts;
begin
  if auth.uid() is null or public.current_role() <> 'student' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into quiz_row from public.quizzes where id = target_quiz_id and is_published for share;
  if not found or not public.is_enrolled(quiz_row.course_id) then
    raise exception 'quiz unavailable' using errcode = '42501';
  end if;
  if now() < quiz_row.opens_at or now() > quiz_row.closes_at then
    raise exception 'quiz is outside its availability window' using errcode = '22023';
  end if;
  insert into public.quiz_attempts (quiz_id, student_id) values (target_quiz_id, auth.uid())
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.save_quiz_attempt(target_quiz_id uuid, new_answers jsonb)
returns public.quiz_attempts
language plpgsql security definer set search_path = public
as $$
declare saved public.quiz_attempts;
begin
  if auth.uid() is null or public.current_role() <> 'student' or jsonb_typeof(new_answers) <> 'object' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.quiz_attempts qa
  set answers = new_answers
  from public.quizzes q
  where qa.quiz_id = target_quiz_id and qa.quiz_id = q.id and qa.student_id = auth.uid()
    and qa.submitted_at is null
    and now() <= least(qa.started_at + make_interval(mins => q.duration_minutes), q.closes_at)
  returning qa.* into saved;
  if not found then raise exception 'attempt is closed or unavailable' using errcode = '42501'; end if;
  return saved;
end;
$$;

create or replace function public.submit_quiz_attempt(target_quiz_id uuid)
returns public.quiz_attempts
language plpgsql security definer set search_path = public
as $$
declare qa public.quiz_attempts; quiz_row public.quizzes; awarded numeric(6,2); deadline timestamptz;
begin
  if auth.uid() is null or public.current_role() <> 'student' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into qa from public.quiz_attempts where quiz_id = target_quiz_id and student_id = auth.uid() for update;
  if not found then raise exception 'attempt unavailable' using errcode = 'P0002'; end if;
  if qa.submitted_at is not null then return qa; end if;
  select * into quiz_row from public.quizzes where id = target_quiz_id;
  deadline := least(qa.started_at + make_interval(mins => quiz_row.duration_minutes), quiz_row.closes_at);
  select coalesce(sum(case
    when (qa.answers ->> qq.id::text) ~ '^[0-9]+$' then
      case when (qa.answers ->> qq.id::text)::integer = qq.correct_index then qq.marks else 0 end
    else 0 end), 0)
  into awarded from public.quiz_questions qq where qq.quiz_id = target_quiz_id;
  update public.quiz_attempts set score = awarded, submitted_at = least(now(), deadline)
    where id = qa.id returning * into qa;
  return qa;
end;
$$;

create or replace function public.save_quiz_questions(target_quiz_id uuid, new_questions jsonb)
returns setof public.quiz_questions
language plpgsql security definer set search_path = public
as $$
declare quiz_row public.quizzes; question_row jsonb; position_index integer := 0;
begin
  if auth.uid() is null or public.current_role() <> 'teacher' or jsonb_typeof(new_questions) <> 'array'
    or jsonb_array_length(new_questions) < 1 or jsonb_array_length(new_questions) > 100 then
    raise exception 'invalid question set or role' using errcode = '42501';
  end if;
  select * into quiz_row from public.quizzes where id = target_quiz_id for update;
  if not found or not public.teaches_course(quiz_row.course_id) or quiz_row.is_published then
    raise exception 'quiz is unavailable for editing' using errcode = '42501';
  end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = target_quiz_id) then
    raise exception 'quiz already has attempts' using errcode = '23514';
  end if;
  delete from public.quiz_questions where quiz_id = target_quiz_id;
  for question_row in select value from jsonb_array_elements(new_questions) loop
    position_index := position_index + 1;
    insert into public.quiz_questions (quiz_id, position, question_text, options, correct_index, marks)
    values (
      target_quiz_id, position_index, question_row ->> 'question_text', question_row -> 'options',
      (question_row ->> 'correct_index')::integer, coalesce((question_row ->> 'marks')::numeric, 1)
    );
  end loop;
  return query select * from public.quiz_questions where quiz_id = target_quiz_id order by position;
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public, anon;
revoke all on function public.save_quiz_attempt(uuid, jsonb) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
revoke all on function public.save_quiz_questions(uuid, jsonb) from public, anon;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.save_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
grant execute on function public.save_quiz_questions(uuid, jsonb) to authenticated;
