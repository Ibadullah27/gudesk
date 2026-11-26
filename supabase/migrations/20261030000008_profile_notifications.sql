alter table public.profiles
  add column phone text,
  add column contact_email text,
  add column avatar_path text,
  add constraint profiles_phone_length check (phone is null or char_length(phone) <= 30),
  add constraint profiles_contact_email_length check (contact_email is null or char_length(contact_email) <= 254);

grant update (full_name, phone, contact_email, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_own on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('announcement','assignment','assignment_deadline','quiz','quiz_deadline','grade','complaint','enrollment','resource')),
  title text not null check (char_length(title) between 1 and 260),
  body text not null check (char_length(body) between 1 and 1000),
  entity_type text,
  entity_id uuid not null,
  available_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, entity_id)
);
create index notifications_user_available_idx on public.notifications(user_id, available_at desc, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, available_at desc) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_read_own on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.notify_new_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, available_at)
  select e.student_id, 'assignment', 'New assignment: ' || new.title,
    'Due ' || to_char(new.due_at at time zone 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC.', 'assignment', new.id, now()
  from public.enrollments e join public.profiles p on p.id = e.student_id and p.is_active
  where e.course_id = new.course_id
  on conflict (user_id, kind, entity_id) do nothing;
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, available_at)
  select e.student_id, 'assignment_deadline', 'Assignment deadline tomorrow: ' || new.title,
    'This assignment is due within 24 hours.', 'assignment', new.id, greatest(now(), new.due_at - interval '24 hours')
  from public.enrollments e join public.profiles p on p.id = e.student_id and p.is_active
  where e.course_id = new.course_id
  on conflict (user_id, kind, entity_id) do nothing;
  return new;
end;
$$;
create trigger assignments_notify_students after insert on public.assignments
for each row execute function public.notify_new_assignment();

create or replace function public.notify_published_quiz()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.is_published and not old.is_published then
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, available_at)
    select e.student_id, 'quiz', 'New quiz: ' || new.title,
      'Available until ' || to_char(new.closes_at at time zone 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC.', 'quiz', new.id, now()
    from public.enrollments e join public.profiles p on p.id = e.student_id and p.is_active
    where e.course_id = new.course_id
    on conflict (user_id, kind, entity_id) do update set title = excluded.title, body = excluded.body, available_at = now(), created_at = now(), read_at = null;
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, available_at)
    select e.student_id, 'quiz_deadline', 'Quiz closes tomorrow: ' || new.title,
      'Submit your attempt before the quiz closes.', 'quiz', new.id, greatest(now(), new.closes_at - interval '24 hours')
    from public.enrollments e join public.profiles p on p.id = e.student_id and p.is_active
    where e.course_id = new.course_id
    on conflict (user_id, kind, entity_id) do update set title = excluded.title, body = excluded.body, available_at = excluded.available_at, created_at = now(), read_at = null;
  end if;
  return new;
end;
$$;
create trigger quizzes_notify_students after update of is_published on public.quizzes
for each row execute function public.notify_published_quiz();

create or replace function public.notify_new_announcement()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.course_id is null then
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    select p.id, 'announcement', 'Announcement: ' || new.title, left(new.body, 900), 'announcement', new.id
    from public.profiles p where p.is_active and p.id <> new.author_id
    on conflict (user_id, kind, entity_id) do nothing;
  else
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    select recipients.user_id, 'announcement', 'Announcement: ' || new.title, left(new.body, 900), 'announcement', new.id
    from (
      select e.student_id as user_id from public.enrollments e where e.course_id = new.course_id
      union select c.teacher_id from public.courses c where c.id = new.course_id
    ) recipients join public.profiles p on p.id = recipients.user_id and p.is_active
    where recipients.user_id <> new.author_id
    on conflict (user_id, kind, entity_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger announcements_notify_recipients after insert on public.announcements
for each row execute function public.notify_new_announcement();

create or replace function public.notify_new_grade()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare assignment_title text;
begin
  if new.marks_obtained is not null and (old.marks_obtained is distinct from new.marks_obtained or old.feedback is distinct from new.feedback) then
    select title into assignment_title from public.assignments where id = new.assignment_id;
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    values (new.student_id, 'grade', 'Assignment graded: ' || coalesce(assignment_title, 'Coursework'),
      'Your grade is ' || new.marks_obtained::text || '.', 'assignment', new.assignment_id)
    on conflict (user_id, kind, entity_id) do update set title = excluded.title, body = excluded.body, available_at = now(), created_at = now(), read_at = null;
  end if;
  return new;
end;
$$;
create trigger submissions_notify_grade after update of marks_obtained, feedback on public.submissions
for each row execute function public.notify_new_grade();

create or replace function public.notify_complaint_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status or old.admin_response is distinct from new.admin_response then
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
    values (new.raised_by, 'complaint', 'Your complaint was updated',
      left(coalesce(nullif(new.admin_response, ''), 'Status: ' || replace(new.status, '_', ' ')), 1000), 'complaint', new.id)
    on conflict (user_id, kind, entity_id) do update set title = excluded.title, body = excluded.body, available_at = now(), created_at = now(), read_at = null;
  end if;
  return new;
end;
$$;
create trigger complaints_notify_owner after update of status, admin_response on public.complaints
for each row execute function public.notify_complaint_update();

create or replace function public.notify_new_enrollment()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare course_title text;
begin
  select title into course_title from public.courses where id = new.course_id;
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  values (new.student_id, 'enrollment', 'Added to a course', 'You are enrolled in ' || coalesce(course_title, 'a course') || '.', 'course', new.course_id)
  on conflict (user_id, kind, entity_id) do nothing;
  return new;
end;
$$;
create trigger enrollments_notify_student after insert on public.enrollments
for each row execute function public.notify_new_enrollment();

create or replace function public.notify_new_resource()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id)
  select e.student_id, 'resource', 'New course resource: ' || new.title, coalesce(left(new.description, 900), 'A new resource is available.'), 'resource', new.id
  from public.enrollments e join public.profiles p on p.id = e.student_id and p.is_active
  where e.course_id = new.course_id
  on conflict (user_id, kind, entity_id) do nothing;
  return new;
end;
$$;
create trigger resources_notify_students after insert on public.resources
for each row execute function public.notify_new_resource();

revoke all on function public.notify_new_assignment() from public, anon, authenticated;
revoke all on function public.notify_published_quiz() from public, anon, authenticated;
revoke all on function public.notify_new_announcement() from public, anon, authenticated;
revoke all on function public.notify_new_grade() from public, anon, authenticated;
revoke all on function public.notify_complaint_update() from public, anon, authenticated;
revoke all on function public.notify_new_enrollment() from public, anon, authenticated;
revoke all on function public.notify_new_resource() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
